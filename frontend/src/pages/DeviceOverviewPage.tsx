import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Grid, Card, CardContent, Typography, LinearProgress, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Skeleton, Alert,
} from '@mui/material';
import {
  CheckCircle, Error as ErrorIcon, Memory, Storage, Speed, AccessTime,
} from '@mui/icons-material';
import { monitorService } from '../services/routerosService';

function StatCard({ title, value, subtitle, icon, color = 'primary' }: any) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {icon}
          <Typography variant="body2" color="text.secondary">{title}</Typography>
        </Box>
        <Typography variant="h5" fontWeight={700} color={`${color}.main`}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
        )}
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function DeviceOverviewPage() {
  const { deviceId } = useParams();
  const id = Number(deviceId);

  const { data: overview, isLoading, error } = useQuery({
    queryKey: ['device-overview', id],
    queryFn: () => monitorService.getOverview(id),
    refetchInterval: 30000,
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Visão Geral</Typography>
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error || !overview) {
    return <Alert severity="error">Erro ao carregar dados do dispositivo</Alert>;
  }

  const res = overview.resources;
  const memUsed = res ? res['total-memory'] - res['free-memory'] : 0;
  const memPercent = res ? Math.round((memUsed / res['total-memory']) * 100) : 0;
  const hddUsed = res ? res['total-hdd-space'] - res['free-hdd-space'] : 0;
  const hddPercent = res ? Math.round((hddUsed / res['total-hdd-space']) * 100) : 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4">
          {overview.identity?.name || overview.device.name}
        </Typography>
        <Chip
          icon={overview.online ? <CheckCircle /> : <ErrorIcon />}
          label={overview.online ? 'Online' : 'Offline'}
          color={overview.online ? 'success' : 'error'}
        />
      </Box>

      {!overview.online ? (
        <Alert severity="error">Dispositivo inacessível</Alert>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="CPU"
                value={`${res?.['cpu-load'] || 0}%`}
                subtitle={res?.['cpu'] || ''}
                icon={<Speed color="primary" />}
                color={res?.['cpu-load'] > 80 ? 'error' : 'primary'}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Memória"
                value={`${memPercent}%`}
                subtitle={`${formatBytes(memUsed)} / ${formatBytes(res?.['total-memory'] || 0)}`}
                icon={<Memory color="secondary" />}
                color={memPercent > 80 ? 'error' : 'secondary'}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Armazenamento"
                value={`${hddPercent}%`}
                subtitle={`${formatBytes(hddUsed)} / ${formatBytes(res?.['total-hdd-space'] || 0)}`}
                icon={<Storage color="warning" />}
                color={hddPercent > 80 ? 'error' : 'warning'}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Uptime"
                value={res?.uptime || '-'}
                subtitle={`RouterOS ${res?.version || '-'}`}
                icon={<AccessTime color="success" />}
                color="success"
              />
            </Grid>
          </Grid>

          {/* Resource Details */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Informações do Sistema</Typography>
                  <Table size="small">
                    <TableBody>
                      {[
                        ['Board', res?.['board-name']],
                        ['Arquitetura', res?.['architecture-name']],
                        ['Versão', res?.version],
                        ['Build Time', res?.['build-time']],
                        ['Factory Software', res?.['factory-software']],
                        ['CPU', res?.cpu],
                        ['CPU Count', res?.['cpu-count']],
                        ['CPU Frequency', res?.['cpu-frequency'] ? `${res['cpu-frequency']} MHz` : '-'],
                      ].map(([label, value]) => (
                        <TableRow key={label as string}>
                          <TableCell sx={{ fontWeight: 600, width: '40%' }}>{label}</TableCell>
                          <TableCell>{value || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Interfaces</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Nome</TableCell>
                          <TableCell>Tipo</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>TX</TableCell>
                          <TableCell>RX</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {overview.interfaces?.slice(0, 10).map((iface: any) => (
                          <TableRow key={iface['.id'] || iface.name}>
                            <TableCell>{iface.name}</TableCell>
                            <TableCell>{iface.type}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={iface.running ? 'Running' : 'Down'}
                                color={iface.running ? 'success' : 'default'}
                              />
                            </TableCell>
                            <TableCell>{formatBytes(iface['tx-byte'] || 0)}</TableCell>
                            <TableCell>{formatBytes(iface['rx-byte'] || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Health */}
          {overview.health && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Saúde do Hardware</Typography>
                <Grid container spacing={2}>
                  {(Array.isArray(overview.health) ? overview.health : [overview.health]).map((item: any, index: number) => (
                    <Grid item xs={6} sm={4} md={3} key={index}>
                      <Typography variant="caption" color="text.secondary">
                        {item.name || Object.keys(item)[0]}
                      </Typography>
                      <Typography variant="h6">
                        {item.value || Object.values(item)[0]}
                        {item.type === 'C' ? '°C' : item.type === 'V' ? 'V' : item.type === 'RPM' ? ' RPM' : ''}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
