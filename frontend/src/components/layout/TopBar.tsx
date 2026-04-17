import React from 'react';
import {
  AppBar, Toolbar, Typography, IconButton, Box, Chip, Menu, MenuItem,
} from '@mui/material';
import {
  Menu as MenuIcon, AccountCircle, Logout,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';

interface TopBarProps {
  drawerWidth: number;
  onMenuToggle: () => void;
}

export default function TopBar({ drawerWidth, onMenuToggle }: TopBarProps) {
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    read_write: 'Leitura/Escrita',
    read_only: 'Somente Leitura',
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        width: { sm: `calc(100% - ${drawerWidth}px)` },
        ml: { sm: `${drawerWidth}px` },
        backgroundImage: 'none',
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          edge="start"
          onClick={onMenuToggle}
          sx={{ mr: 2, display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
          MikroTik Manager
        </Typography>
        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={roleLabels[user.role] || user.role}
              size="small"
              color={user.role === 'admin' ? 'error' : user.role === 'read_write' ? 'warning' : 'default'}
            />
            <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
              <AccountCircle />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
            >
              <MenuItem disabled>
                <Typography variant="body2">{user.full_name}</Typography>
              </MenuItem>
              <MenuItem onClick={logout}>
                <Logout fontSize="small" sx={{ mr: 1 }} /> Sair
              </MenuItem>
            </Menu>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
