import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, CircularProgress, Alert, Button, Chip,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { monitorService } from '../services/routerosService';

const topicColors: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
  system: 'success',
  critical: 'error',
};

export default function DeviceLogsPage() {
  const { deviceId } = useParams();
  const id = Number(deviceId);

  const { data: logs, isLoading, error, refetch } = useQuery({
    queryKey: ['device-logs', id],
    queryFn: () => monitorService.getLogs(id),
    refetchInterval: 15000,
    enabled: !!id,
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Logs do Sistema</Typography>
        <Button startIcon={<Refresh />} onClick={() => refetch()}>Atualizar</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Erro ao carregar logs</Alert>}

      <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 200px)' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Data/Hora</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Tópicos</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Mensagem</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} align="center"><CircularProgress /></TableCell></TableRow>
            ) : Array.isArray(logs) ? (
              [...logs].reverse().map((log: any, i: number) => (
                <TableRow key={log['.id'] || i} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{log.time || '-'}</TableCell>
                  <TableCell>
                    {(log.topics || '').split(',').map((topic: string) => (
                      <Chip
                        key={topic}
                        size="small"
                        label={topic.trim()}
                        color={topicColors[topic.trim()] || 'default'}
                        sx={{ mr: 0.5 }}
                      />
                    ))}
                  </TableCell>
                  <TableCell>{log.message || '-'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={3}>Sem logs disponíveis</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
