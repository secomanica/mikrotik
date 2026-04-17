import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, CircularProgress, Chip,
} from '@mui/material';
import api from '../services/api';
import type { AuditLog } from '../types/routeros';

const actionColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  CREATE: 'success',
  PUT: 'success',
  UPDATE: 'warning',
  PATCH: 'warning',
  DELETE: 'error',
  POST: 'info',
  GET: 'default',
};

export default function AuditPage() {
  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const res = await api.get('/audit?limit=100');
      return res.data;
    },
  });

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Auditoria</Typography>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Data/Hora</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Usuário</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Ação</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Recurso</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Dispositivo</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Detalhes</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>IP</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} align="center"><CircularProgress /></TableCell></TableRow>
            ) : logs?.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {new Date(log.created_at).toLocaleString('pt-BR')}
                </TableCell>
                <TableCell>{log.username}</TableCell>
                <TableCell>
                  <Chip size="small" label={log.action} color={actionColors[log.action] || 'default'} />
                </TableCell>
                <TableCell>{log.resource}</TableCell>
                <TableCell>{log.device_name || '-'}</TableCell>
                <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {log.details || '-'}
                </TableCell>
                <TableCell>{log.ip_address || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
