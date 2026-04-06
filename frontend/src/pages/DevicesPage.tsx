import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, FormControlLabel, Switch, Alert, CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add, Edit, Delete, PlayArrow, Visibility, CheckCircle, Error as ErrorIcon,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { deviceService } from '../services/deviceService';
import type { Device, DeviceCreate } from '../types/device';

export default function DevicesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, isAdmin } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [form, setForm] = useState<DeviceCreate>({
    name: '', host: '', port: 443, use_ssl: true, username: 'admin', password: '', notes: '',
  });
  const [testResult, setTestResult] = useState<any>(null);

  const { data: devices, isLoading } = useQuery<Device[]>({
    queryKey: ['devices'],
    queryFn: deviceService.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: DeviceCreate) => deviceService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['devices'] }); handleClose(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deviceService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const testMutation = useMutation({
    mutationFn: (id: number) => deviceService.testConnection(id),
  });

  const handleClose = () => {
    setDialogOpen(false);
    setEditDevice(null);
    setTestResult(null);
    setForm({ name: '', host: '', port: 443, use_ssl: true, username: 'admin', password: '', notes: '' });
  };

  const handleSubmit = () => {
    if (editDevice) {
      deviceService.update(editDevice.id, form).then(() => {
        queryClient.invalidateQueries({ queryKey: ['devices'] });
        handleClose();
      });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (device: Device) => {
    setEditDevice(device);
    setForm({
      name: device.name,
      host: device.host,
      port: device.port,
      use_ssl: device.use_ssl,
      username: device.username,
      password: '',
      notes: device.notes || '',
    });
    setDialogOpen(true);
  };

  const handleTest = async (id: number) => {
    const result = await testMutation.mutateAsync(id);
    setTestResult(result);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Dispositivos</Typography>
        {canWrite && (
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
            Novo Dispositivo
          </Button>
        )}
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Host</TableCell>
              <TableCell>Porta</TableCell>
              <TableCell>Versão</TableCell>
              <TableCell>Board</TableCell>
              <TableCell>Último Acesso</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} align="center"><CircularProgress /></TableCell>
              </TableRow>
            ) : devices?.map((device) => (
              <TableRow key={device.id} hover>
                <TableCell>
                  <Typography fontWeight={600}>{device.name}</Typography>
                </TableCell>
                <TableCell>{device.host}</TableCell>
                <TableCell>{device.port}</TableCell>
                <TableCell>{device.ros_version || '-'}</TableCell>
                <TableCell>{device.board_name || '-'}</TableCell>
                <TableCell>
                  {device.last_seen ? new Date(device.last_seen).toLocaleString('pt-BR') : '-'}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={device.is_active ? 'Ativo' : 'Inativo'}
                    color={device.is_active ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Visualizar">
                    <IconButton onClick={() => navigate(`/devices/${device.id}/overview`)} size="small">
                      <Visibility />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Testar Conexão">
                    <IconButton onClick={() => handleTest(device.id)} size="small" color="primary">
                      <PlayArrow />
                    </IconButton>
                  </Tooltip>
                  {canWrite && (
                    <Tooltip title="Editar">
                      <IconButton onClick={() => handleEdit(device)} size="small">
                        <Edit />
                      </IconButton>
                    </Tooltip>
                  )}
                  {isAdmin && (
                    <Tooltip title="Remover">
                      <IconButton
                        onClick={() => { if (confirm('Remover dispositivo?')) deleteMutation.mutate(device.id); }}
                        size="small"
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editDevice ? 'Editar Dispositivo' : 'Novo Dispositivo'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Nome" fullWidth margin="normal" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required
          />
          <TextField
            label="Host (IP/Hostname)" fullWidth margin="normal" value={form.host}
            onChange={(e) => setForm({ ...form, host: e.target.value })} required
          />
          <TextField
            label="Porta" type="number" fullWidth margin="normal" value={form.port}
            onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 443 })}
          />
          <FormControlLabel
            control={<Switch checked={form.use_ssl} onChange={(e) => setForm({ ...form, use_ssl: e.target.checked })} />}
            label="Usar SSL/HTTPS"
          />
          <TextField
            label="Usuário RouterOS" fullWidth margin="normal" value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} required
          />
          <TextField
            label="Senha RouterOS" type="password" fullWidth margin="normal" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editDevice}
            helperText={editDevice ? 'Deixe vazio para manter a senha atual' : ''}
          />
          <TextField
            label="Notas" fullWidth margin="normal" multiline rows={2} value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? <CircularProgress size={20} /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Result Dialog */}
      <Dialog open={!!testResult} onClose={() => setTestResult(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Resultado do Teste</DialogTitle>
        <DialogContent>
          {testResult?.success ? (
            <Alert severity="success" icon={<CheckCircle />}>
              <Typography fontWeight={600}>Conexão bem-sucedida!</Typography>
              <Typography variant="body2">Versão: {testResult.data?.version}</Typography>
              <Typography variant="body2">Board: {testResult.data?.['board-name']}</Typography>
              <Typography variant="body2">Uptime: {testResult.data?.uptime}</Typography>
            </Alert>
          ) : (
            <Alert severity="error" icon={<ErrorIcon />}>
              <Typography fontWeight={600}>Falha na conexão</Typography>
              <Typography variant="body2">{testResult?.error || 'Erro desconhecido'}</Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestResult(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
