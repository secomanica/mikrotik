import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Grid, Card, CardContent, Typography, Chip, IconButton, Skeleton,
  LinearProgress, Alert,
} from '@mui/material';
import { Router, Visibility, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { deviceService } from '../services/deviceService';
import type { Device, DeviceStatus } from '../types/device';

function DeviceCard({ device }: { device: Device }) {
  const navigate = useNavigate();
  const { data: status, isLoading } = useQuery<DeviceStatus>({
    queryKey: ['device-status', device.id],
    queryFn: () => deviceService.getStatus(device.id),
    refetchInterval: 60000,
  });

  const memPercent = status?.memory_total
    ? Math.round(((status.memory_used || 0) / status.memory_total) * 100)
    : 0;

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
        border: 1,
        borderColor: status?.online ? 'success.main' : 'error.main',
        borderStyle: 'solid',
        borderWidth: 1,
        opacity: status?.online ? 1 : 0.7,
      }}
      onClick={() => navigate(`/devices/${device.id}/overview`)}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Router color={status?.online ? 'success' : 'error'} />
            <Typography variant="h6" fontSize="1rem" fontWeight={600}>
              {device.name}
            </Typography>
          </Box>
          <Chip
            icon={status?.online ? <CheckCircle /> : <ErrorIcon />}
            label={status?.online ? 'Online' : 'Offline'}
            size="small"
            color={status?.online ? 'success' : 'error'}
            variant="outlined"
          />
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          {device.host}:{device.port}
        </Typography>

        {isLoading ? (
          <Skeleton variant="rectangular" height={60} sx={{ mt: 1 }} />
        ) : status?.online ? (
          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption">CPU</Typography>
              <Typography variant="caption">{status.cpu_load}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={status.cpu_load || 0}
              color={status.cpu_load && status.cpu_load > 80 ? 'error' : 'primary'}
              sx={{ mb: 1, height: 6, borderRadius: 3 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption">Memória</Typography>
              <Typography variant="caption">{memPercent}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={memPercent}
              color={memPercent > 80 ? 'error' : 'secondary'}
              sx={{ mb: 1, height: 6, borderRadius: 3 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {status.ros_version || '-'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {status.uptime || '-'}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            Dispositivo inacessível
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: devices, isLoading, error } = useQuery<Device[]>({
    queryKey: ['devices'],
    queryFn: deviceService.list,
  });

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Erro ao carregar dispositivos</Alert>}

      {isLoading ? (
        <Grid container spacing={2}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : devices && devices.length > 0 ? (
        <Grid container spacing={2}>
          {devices.map((device) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={device.id}>
              <DeviceCard device={device} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info">
          Nenhum dispositivo cadastrado. Acesse "Dispositivos" para adicionar.
        </Alert>
      )}
    </Box>
  );
}
