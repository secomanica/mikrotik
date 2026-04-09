import { spawn } from 'child_process';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import type { UserInfo, LoginRequest, LoginResponse } from '@webgate/shared';
import { jwtSecret } from '../config';
import { logger } from '../utils/logger';
import { getDb } from '../utils/db';

/**
 * Authenticates against Windows using RDP credential validation.
 *
 * Strategy:
 * 1. On Windows: uses PowerShell to validate credentials against the local SAM/AD
 * 2. The same credentials are then used for the RDP session (single sign-on)
 *
 * In production on Windows, we use the `LogonUser` Win32 API via PowerShell.
 * For development/testing on non-Windows, we use a configurable mock mode.
 */
export class WindowsAuthenticator {
  /**
   * Validate Windows credentials using PowerShell's LogonUser API.
   * Returns user info on success, null on failure.
   */
  async authenticate(request: LoginRequest): Promise<LoginResponse> {
    const { username, password, domain } = request;

    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }

    try {
      const userInfo = await this.validateWindowsCredentials(
        username,
        password,
        domain ?? '.'
      );

      if (!userInfo) {
        return { success: false, error: 'Invalid credentials' };
      }

      const sessionId = uuidv4();
      const token = jwt.sign(
        {
          sessionId,
          username: userInfo.username,
          domain: userInfo.domain,
          groups: userInfo.groups,
          isAdmin: userInfo.isAdmin,
        },
        jwtSecret,
        { expiresIn: '8h' }
      );

      // Store session in database
      const db = getDb();
      db.prepare(`
        INSERT INTO sessions (id, user_id, username, domain, token, created_at, last_activity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        `${userInfo.domain}\\${userInfo.username}`,
        userInfo.username,
        userInfo.domain,
        token,
        new Date().toISOString(),
        new Date().toISOString()
      );

      logger.info(`User authenticated: ${userInfo.domain}\\${userInfo.username}`);
      return { success: true, token, user: userInfo };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      logger.error(`Authentication failed for ${username}: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Validate credentials using PowerShell on Windows.
   * Uses the Win32 LogonUser API to validate credentials against local SAM or Active Directory.
   */
  private validateWindowsCredentials(
    username: string,
    password: string,
    domain: string
  ): Promise<UserInfo | null> {
    return new Promise((resolve, reject) => {
      // PowerShell script to validate Windows credentials and get user info
      const psScript = `
        $ErrorActionPreference = 'Stop'
        Add-Type -TypeDefinition @"
          using System;
          using System.Runtime.InteropServices;
          public class WinAuth {
            [DllImport("advapi32.dll", SetLastError = true)]
            public static extern bool LogonUser(
              string lpszUsername, string lpszDomain, string lpszPassword,
              int dwLogonType, int dwLogonProvider, out IntPtr phToken);
            [DllImport("kernel32.dll")]
            public static extern bool CloseHandle(IntPtr hObject);
          }
"@
        $token = [IntPtr]::Zero
        $result = [WinAuth]::LogonUser(
          '${username.replace(/'/g, "''")}',
          '${domain.replace(/'/g, "''")}',
          '${password.replace(/'/g, "''")}',
          3, 0, [ref]$token)
        if ($result) {
          [WinAuth]::CloseHandle($token)
          # Get user groups
          $user = New-Object System.Security.Principal.NTAccount('${domain.replace(/'/g, "''")}', '${username.replace(/'/g, "''")}')
          $sid = $user.Translate([System.Security.Principal.SecurityIdentifier]).Value
          $groups = @()
          try {
            $adUser = [ADSI]"WinNT://${domain.replace(/'/g, "''")}/${username.replace(/'/g, "''")},user"
            $adUser.Groups() | ForEach-Object {
              $groups += $_.GetType().InvokeMember("Name", 'GetProperty', $null, $_, $null)
            }
          } catch { }
          $isAdmin = $groups -contains 'Administrators'
          @{
            success = $true
            username = '${username.replace(/'/g, "''")}'
            domain = '${domain.replace(/'/g, "''")}'
            sid = $sid
            groups = $groups
            isAdmin = $isAdmin
          } | ConvertTo-Json
        } else {
          @{ success = $false; error = "LogonUser failed" } | ConvertTo-Json
        }
      `;

      // Check if running on Windows
      if (process.platform !== 'win32') {
        logger.warn('Non-Windows platform detected - using development mock authentication');
        // Development mode: accept any credentials
        resolve({
          username,
          domain: domain === '.' ? 'LOCAL' : domain,
          displayName: username,
          groups: ['Users'],
          isAdmin: username.toLowerCase() === 'admin',
          sid: `S-1-5-21-mock-${Date.now()}`,
        });
        return;
      }

      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-Command', psScript,
      ]);

      let stdout = '';
      let stderr = '';

      ps.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      ps.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      ps.on('close', (code) => {
        if (code !== 0 || stderr) {
          logger.error(`PowerShell auth error: ${stderr}`);
          resolve(null);
          return;
        }

        try {
          const result = JSON.parse(stdout);
          if (result.success) {
            resolve({
              username: result.username,
              domain: result.domain,
              displayName: result.username,
              groups: result.groups || [],
              isAdmin: result.isAdmin || false,
              sid: result.sid,
            });
          } else {
            resolve(null);
          }
        } catch {
          logger.error(`Failed to parse auth response: ${stdout}`);
          resolve(null);
        }
      });

      ps.on('error', (err) => {
        reject(new Error(`Failed to spawn PowerShell: ${err.message}`));
      });
    });
  }

  /**
   * Verify a JWT token and return the decoded payload.
   */
  verifyToken(token: string): jwt.JwtPayload | null {
    try {
      const decoded = jwt.verify(token, jwtSecret);
      if (typeof decoded === 'object') {
        // Update last activity
        const db = getDb();
        db.prepare('UPDATE sessions SET last_activity = ? WHERE id = ? AND active = 1')
          .run(new Date().toISOString(), (decoded as jwt.JwtPayload).sessionId);
        return decoded as jwt.JwtPayload;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Invalidate a session.
   */
  logout(sessionId: string): void {
    const db = getDb();
    db.prepare('UPDATE sessions SET active = 0 WHERE id = ?').run(sessionId);
    logger.info(`Session invalidated: ${sessionId}`);
  }
}

export const authenticator = new WindowsAuthenticator();
