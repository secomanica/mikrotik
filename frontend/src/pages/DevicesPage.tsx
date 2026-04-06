import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, FormControlLabel, Switch, Alert, CircularProgress,
  Tooltip, MenuItem, Grid, Divider, Tabs, Tab, InputAdornment,
} from '@mui/material';
import {
  Add, Edit, Delete, PlayArrow, Visibility, CheckCircle, Error as ErrorIcon,
  FilterList,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { deviceService } from '../services/deviceService';
import { clientService } from '../services/clientService';
import type { Device, DeviceCreate } from '../types/device';
import type { Client } from '../types/client';

const emptyForm: DeviceCreate = {
  name: '', host: '', api_port: 443, use_ssl: true,
  username: 'admin', password: '',
  public_ip: '', ssh_port: 22, winbox_port: 8291, notes: '',
  client_id: null,
};

export default function DevicesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, isAdmin } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [form, setForm] = useState<DeviceCreate>({ ...emptyForm });
  const [testResult, setTestResult] = useState<any>(null);
  const [clientFilter, setClientFilter] = useState<number | ''>('');

  const { data: devices, isLoading } = useQuery<Device[]>({
    queryKey: ['devices'],
    queryFn: deviceService.list,
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: clientService.list,
  });

  const filteredDevices = devices?.filter(d =>
    clientFilter === '' || d.client_id === clientFilter
  ) || [];

  const createMutation = useMutation({
    mutationFn: (data: DeviceCreate) => deviceService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['devices'] }); handleClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DeviceCreate> }) =>
      deviceService.update(id, data),
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
    setForm({ ...emptyForm });
  };

  const handleSubmit = () => {
    // Clean empty optional fields
    const cleanForm = { ...form };
    if (!cleanForm.public_ip) delete cleanForm.public_ip;
    if (!cleanForm.notes) delete cleanForm.notes;
    if (!cleanForm.client_id) cleanForm.client_id = null;

    if (editDevice) {
      const updateData: any = { ...cleanForm };
      if (!updateData.password) delete updateData.password;
      updateMutation.mutate({ id: editDevice.id, data: updateData });
    } else {
      createMutation.mutate(cleanForm);
    }
  };

  const handleEdit = (device: Device) => {
    setEditDevice(device);
    setForm({
      name: device.name,
      client_id: device.client_id,
      host: device.host,
      api_port: device.api_port,
      use_ssl: device.use_ssl,
      username: device.username,
      password: '',
      public_ip: device.public_ip || '',
      ssh_port: device.ssh_port || 22,
      winbox_port: device.winbox_port || 8291,
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
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Client filter */}
          <TextField
            select size="small" value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value === '' ? '' : Number(e.target.value))}
            sx={{ minWidth: 180 }}
            label="Filtrar por Cliente"
            InputProps={{
              startAdornment: <InputAdornment position="start"><FilterList fontSize="small" /></InputAdornment>,
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            {clients?.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </TextField>
          {canWrite && (
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
              Novo Dispositivo
            </Button>
          )}
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Host</TableCell>
              <TableCell>Porta API</TableCell>
              <TableCell>IP Público</TableCell>
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
                <TableCell colSpan={10} align="center"><CircularProgress /></TableCell>
              </TableRow>
            ) : filteredDevices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">Nenhum dispositivo encontrado</TableCell>
              </TableRow>
            ) : filteredDevices.map((device) => (
              <TableRow key={device.id} hover>
                <TableCell>
                  <Typography fontWeight={600}>{device.name}</Typography>
                  {device.identity && device.identity !== device.name && (
                    <Typography variant="caption" color="text.secondary">{device.identity}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {device.client_name ? (
                    <Chip size="small" label={device.client_name} variant="outlined" />
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell>{device.host}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={`${device.api_port} ${device.use_ssl ? '(SSL)' : ''}`}
                    color={device.api_port !== 443 ? 'warning' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{device.public_ip || '-'}</TableCell>
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
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
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
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{editDevice ? 'Editar Dispositivo' : 'Cadastrar Novo Dispositivo'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            {/* Basic Info */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="primary" gutterBottom>Identificação</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nome do Dispositivo" fullWidth value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required
                helperText="Nome amigável para identificação"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Cliente" select fullWidth value={form.client_id || ''}
                onChange={(e) => setForm({ ...form, client_id: e.target.value ? Number(e.target.value) : null })}
                helperText="Associar a um cliente (opcional)"
              >
                <MenuItem value="">Nenhum</MenuItem>
                {clients?.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name} ({c.code})</MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Connection */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="primary" gutterBottom>Conexão API REST</Typography>
            </Grid>
            <Grid item xs={12} sm={5}>
              <TextField
                label="Host (IP ou Hostname)" fullWidth value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })} required
                helperText="IP de gerenciamento do dispositivo"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                label="Porta da API" type="number" fullWidth value={form.api_port}
                onChange={(e) => setForm({ ...form, api_port: parseInt(e.target.value) || 443 })}
                required
                helperText="Padrão: 443 (HTTPS) ou 80 (HTTP)"
                InputProps={{
                  inputProps: { min: 1, max: 65535 },
                }}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.use_ssl}
                    onChange={(e) => setForm({
                      ...form,
                      use_ssl: e.target.checked,
                      api_port: e.target.checked ? 443 : 80,
                    })}
                  />
                }
                label="Usar SSL/HTTPS"
                sx={{ mt: 1 }}
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                {form.use_ssl ? 'Conexão criptografada (recomendado)' : 'Conexão sem criptografia'}
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info" variant="outlined" sx={{ fontSize: '0.8rem' }}>
                A porta da API pode ser alterada no RouterOS em <code>/ip/service</code>.
                Se a porta 443 está em uso por outro serviço, configure uma porta alternativa
                (ex: 8443, 8728) no RouterOS e informe aqui.
              </Alert>
            </Grid>

            {/* Authentication */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="primary" gutterBottom>Autenticação RouterOS</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Usuário RouterOS" fullWidth value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })} required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Senha RouterOS" type="password" fullWidth value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editDevice}
                helperText={editDevice ? 'Deixe vazio para manter a senha atual' : 'Senha do usuário no RouterOS'}
              />
            </Grid>

            {/* Additional Connection Info */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Informações Adicionais (para VPN e acesso remoto)
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="IP Público" fullWidth value={form.public_ip || ''}
                onChange={(e) => setForm({ ...form, public_ip: e.target.value })}
                helperText="Usado como endpoint para túneis VPN"
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                label="Porta SSH" type="number" fullWidth value={form.ssh_port || 22}
                onChange={(e) => setForm({ ...form, ssh_port: parseInt(e.target.value) || 22 })}
                InputProps={{ inputProps: { min: 1, max: 65535 } }}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                label="Porta Winbox" type="number" fullWidth value={form.winbox_port || 8291}
                onChange={(e) => setForm({ ...form, winbox_port: parseInt(e.target.value) || 8291 })}
                InputProps={{ inputProps: { min: 1, max: 65535 } }}
              />
            </Grid>

            {/* Notes */}
            <Grid item xs={12}>
              <TextField
                label="Notas" fullWidth multiline rows={2} value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {(createMutation.isPending || updateMutation.isPending) ? <CircularProgress size={20} /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Result Dialog */}
      <Dialog open={!!testResult} onClose={() => setTestResult(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Resultado do Teste de Conexão</DialogTitle>
        <DialogContent>
          {testResult?.success ? (
            <Alert severity="success" icon={<CheckCircle />}>
              <Typography fontWeight={600}>Conexão bem-sucedida!</Typography>
              <Typography variant="body2">Versão: {testResult.data?.version}</Typography>
              <Typography variant="body2">Board: {testResult.data?.['board-name']}</Typography>
              <Typography variant="body2">Arquitetura: {testResult.data?.['architecture-name']}</Typography>
              <Typography variant="body2">Uptime: {testResult.data?.uptime}</Typography>
              <Typography variant="body2">CPU Load: {testResult.data?.['cpu-load']}%</Typography>
            </Alert>
          ) : (
            <Alert severity="error" icon={<ErrorIcon />}>
              <Typography fontWeight={600}>Falha na conexão</Typography>
              <Typography variant="body2">{testResult?.error || 'Erro desconhecido'}</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Verifique: IP/Host, Porta da API, SSL, credenciais e se o serviço www-ssl está ativo no RouterOS.
              </Typography>
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
