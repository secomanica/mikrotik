import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, CardContent, Grid, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Alert,
  CircularProgress, Tooltip, Tabs, Tab, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, FormControlLabel, Switch, LinearProgress,
} from '@mui/material';
import {
  Add, ArrowBack, Router, VpnKey, CheckCircle, Error as ErrorIcon, PlayArrow,
  Delete, Visibility, Sync, Link,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { clientService, vpnTunnelService } from '../services/clientService';
import { deviceService } from '../services/deviceService';
import type { Client, VPNTunnel, VPNTunnelCreate, VPNTunnelDeploy } from '../types/client';
import type { Device, DeviceStatus } from '../types/device';

const tunnelTypeLabels: Record<string, string> = {
  wireguard: 'WireGuard',
  ipsec: 'IPSec',
  gre: 'GRE',
  ipip: 'IPIP',
  eoip: 'EoIP',
};

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  pending: 'default',
  deployed: 'info',
  active: 'success',
  error: 'error',
};

export default function ClientDetailPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite } = useAuth();
  const id = Number(clientId);

  const [tab, setTab] = useState(0);
  const [tunnelDialogOpen, setTunnelDialogOpen] = useState(false);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [selectedTunnel, setSelectedTunnel] = useState<VPNTunnel | null>(null);
  const [deployResult, setDeployResult] = useState<any>(null);
  const [deployOpts, setDeployOpts] = useState<VPNTunnelDeploy>({
    add_firewall_rules: true,
    add_routes: false,
    routes_device_a: '',
    routes_device_b: '',
  });
  const [tunnelForm, setTunnelForm] = useState<VPNTunnelCreate>({
    name: '', client_id: id, tunnel_type: 'wireguard',
    device_a_id: 0, device_b_id: 0,
    subnet: '10.255.255.0/30',
    device_a_tunnel_ip: '10.255.255.1/30',
    device_b_tunnel_ip: '10.255.255.2/30',
    device_a_port: 13231, device_b_port: 13231,
  });

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ['client', id],
    queryFn: () => clientService.get(id),
    enabled: !!id,
  });

  const { data: devices } = useQuery<Device[]>({
    queryKey: ['devices', 'client', id],
    queryFn: async () => {
      const res = await deviceService.list();
      return res;
    },
  });

  const clientDevices = devices?.filter(d => d.client_id === id) || [];
  const allDevices = devices || [];

  const { data: tunnels, isLoading: tunnelsLoading } = useQuery<VPNTunnel[]>({
    queryKey: ['vpn-tunnels', id],
    queryFn: () => vpnTunnelService.list(id),
    enabled: !!id,
  });

  const createTunnelMutation = useMutation({
    mutationFn: (data: VPNTunnelCreate) => vpnTunnelService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vpn-tunnels', id] });
      setTunnelDialogOpen(false);
    },
  });

  const deleteTunnelMutation = useMutation({
    mutationFn: (tunnelId: number) => vpnTunnelService.remove(tunnelId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vpn-tunnels', id] }),
  });

  const handleDeploy = async () => {
    if (!selectedTunnel) return;
    try {
      const result = await vpnTunnelService.deploy(selectedTunnel.id, deployOpts);
      setDeployResult(result);
      queryClient.invalidateQueries({ queryKey: ['vpn-tunnels', id] });
    } catch (err: any) {
      setDeployResult({ errors: [err.response?.data?.detail || 'Erro ao fazer deploy'] });
    }
  };

  if (clientLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;
  }

  if (!client) {
    return <Alert severity="error">Cliente não encontrado</Alert>;
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/clients')} sx={{ mb: 2 }}>
        Voltar
      </Button>

      {/* Client Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h4" fontWeight={700}>{client.name}</Typography>
              <Chip label={client.code} size="small" sx={{ mt: 0.5 }} />
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              {client.contact_name && <Typography variant="body2">{client.contact_name}</Typography>}
              {client.contact_email && <Typography variant="body2">{client.contact_email}</Typography>}
              {client.contact_phone && <Typography variant="body2">{client.contact_phone}</Typography>}
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<Router />} label={`Dispositivos (${clientDevices.length})`} iconPosition="start" />
        <Tab icon={<VpnKey />} label={`Túneis VPN (${tunnels?.length || 0})`} iconPosition="start" />
      </Tabs>

      {/* Tab: Devices */}
      {tab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            {canWrite && (
              <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/devices')}>
                Gerenciar Dispositivos
              </Button>
            )}
          </Box>

          {clientDevices.length === 0 ? (
            <Alert severity="info">
              Nenhum dispositivo associado a este cliente. Adicione dispositivos na aba "Dispositivos" e selecione este cliente.
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell>Host</TableCell>
                    <TableCell>Porta API</TableCell>
                    <TableCell>IP Público</TableCell>
                    <TableCell>Versão</TableCell>
                    <TableCell>Board</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clientDevices.map((device) => (
                    <TableRow key={device.id} hover>
                      <TableCell><Typography fontWeight={600}>{device.name}</Typography></TableCell>
                      <TableCell>{device.host}</TableCell>
                      <TableCell>{device.api_port}</TableCell>
                      <TableCell>{device.public_ip || '-'}</TableCell>
                      <TableCell>{device.ros_version || '-'}</TableCell>
                      <TableCell>{device.board_name || '-'}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Visualizar">
                          <IconButton size="small" onClick={() => navigate(`/devices/${device.id}/overview`)}>
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Tab: VPN Tunnels */}
      {tab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            {canWrite && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  setTunnelForm({ ...tunnelForm, client_id: id });
                  setTunnelDialogOpen(true);
                }}
                disabled={allDevices.length < 2}
              >
                Novo Túnel VPN
              </Button>
            )}
          </Box>

          {tunnelsLoading ? (
            <CircularProgress />
          ) : tunnels && tunnels.length > 0 ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Dispositivo A</TableCell>
                    <TableCell>Dispositivo B</TableCell>
                    <TableCell>Subnet</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tunnels.map((tunnel) => (
                    <TableRow key={tunnel.id} hover>
                      <TableCell><Typography fontWeight={600}>{tunnel.name}</Typography></TableCell>
                      <TableCell>
                        <Chip size="small" label={tunnelTypeLabels[tunnel.tunnel_type] || tunnel.tunnel_type} />
                      </TableCell>
                      <TableCell>
                        {tunnel.device_a_name || `#${tunnel.device_a_id}`}
                        <Typography variant="caption" display="block" color="text.secondary">
                          {tunnel.device_a_endpoint}:{tunnel.device_a_port}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {tunnel.device_b_name || `#${tunnel.device_b_id}`}
                        <Typography variant="caption" display="block" color="text.secondary">
                          {tunnel.device_b_endpoint}:{tunnel.device_b_port}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{tunnel.subnet || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          A: {tunnel.device_a_tunnel_ip} | B: {tunnel.device_b_tunnel_ip}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={tunnel.status}
                          color={statusColors[tunnel.status] || 'default'}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {canWrite && tunnel.status === 'pending' && (
                          <Tooltip title="Deploy (aplicar nos dispositivos)">
                            <IconButton
                              size="small" color="primary"
                              onClick={() => { setSelectedTunnel(tunnel); setDeployDialogOpen(true); setDeployResult(null); }}
                            >
                              <PlayArrow />
                            </IconButton>
                          </Tooltip>
                        )}
                        {tunnel.status === 'deployed' && (
                          <Tooltip title="Verificar Status">
                            <IconButton
                              size="small" color="info"
                              onClick={async () => {
                                const status = await vpnTunnelService.checkStatus(tunnel.id);
                                alert(JSON.stringify(status, null, 2));
                              }}
                            >
                              <Sync />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canWrite && (
                          <Tooltip title="Remover">
                            <IconButton
                              size="small" color="error"
                              onClick={() => { if (confirm('Remover túnel?')) deleteTunnelMutation.mutate(tunnel.id); }}
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
          ) : (
            <Alert severity="info">
              Nenhum túnel VPN configurado. Crie uma conexão segura entre os MikroTiks deste cliente.
            </Alert>
          )}
        </Box>
      )}

      {/* Create Tunnel Dialog */}
      <Dialog open={tunnelDialogOpen} onClose={() => setTunnelDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Novo Túnel VPN</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nome do Túnel" fullWidth value={tunnelForm.name}
                onChange={(e) => setTunnelForm({ ...tunnelForm, name: e.target.value })} required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Tipo de Túnel" select fullWidth value={tunnelForm.tunnel_type}
                onChange={(e) => setTunnelForm({ ...tunnelForm, tunnel_type: e.target.value })}
              >
                <MenuItem value="wireguard">WireGuard (recomendado)</MenuItem>
                <MenuItem value="ipsec">IPSec</MenuItem>
                <MenuItem value="gre">GRE</MenuItem>
                <MenuItem value="ipip">IPIP</MenuItem>
                <MenuItem value="eoip">EoIP</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12}><Typography variant="subtitle2" color="primary">Dispositivos</Typography></Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Dispositivo A" select fullWidth value={tunnelForm.device_a_id || ''}
                onChange={(e) => setTunnelForm({ ...tunnelForm, device_a_id: Number(e.target.value) })}
              >
                {allDevices.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name} ({d.host}) {d.client_id === id ? '' : `[${d.client_name || 'outro'}]`}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Dispositivo B" select fullWidth value={tunnelForm.device_b_id || ''}
                onChange={(e) => setTunnelForm({ ...tunnelForm, device_b_id: Number(e.target.value) })}
              >
                {allDevices.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name} ({d.host}) {d.client_id === id ? '' : `[${d.client_name || 'outro'}]`}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}><Typography variant="subtitle2" color="primary">Rede do Túnel</Typography></Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                label="Subnet" fullWidth value={tunnelForm.subnet}
                onChange={(e) => setTunnelForm({ ...tunnelForm, subnet: e.target.value })}
                helperText="Ex: 10.255.255.0/30"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="IP Túnel - Dispositivo A" fullWidth value={tunnelForm.device_a_tunnel_ip}
                onChange={(e) => setTunnelForm({ ...tunnelForm, device_a_tunnel_ip: e.target.value })}
                helperText="Ex: 10.255.255.1/30"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="IP Túnel - Dispositivo B" fullWidth value={tunnelForm.device_b_tunnel_ip}
                onChange={(e) => setTunnelForm({ ...tunnelForm, device_b_tunnel_ip: e.target.value })}
                helperText="Ex: 10.255.255.2/30"
              />
            </Grid>

            <Grid item xs={12}><Typography variant="subtitle2" color="primary">Endpoints</Typography></Grid>

            <Grid item xs={6} sm={3}>
              <TextField
                label="Endpoint A (IP)" fullWidth value={tunnelForm.device_a_endpoint || ''}
                onChange={(e) => setTunnelForm({ ...tunnelForm, device_a_endpoint: e.target.value })}
                helperText="IP público do disp. A"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                label="Porta A" type="number" fullWidth value={tunnelForm.device_a_port || ''}
                onChange={(e) => setTunnelForm({ ...tunnelForm, device_a_port: Number(e.target.value) })}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                label="Endpoint B (IP)" fullWidth value={tunnelForm.device_b_endpoint || ''}
                onChange={(e) => setTunnelForm({ ...tunnelForm, device_b_endpoint: e.target.value })}
                helperText="IP público do disp. B"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                label="Porta B" type="number" fullWidth value={tunnelForm.device_b_port || ''}
                onChange={(e) => setTunnelForm({ ...tunnelForm, device_b_port: Number(e.target.value) })}
              />
            </Grid>

            {tunnelForm.tunnel_type === 'ipsec' && (
              <>
                <Grid item xs={12}><Typography variant="subtitle2" color="primary">IPSec</Typography></Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Pre-Shared Key (deixe vazio para gerar automaticamente)"
                    fullWidth type="password"
                    value={tunnelForm.ipsec_secret || ''}
                    onChange={(e) => setTunnelForm({ ...tunnelForm, ipsec_secret: e.target.value })}
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <TextField
                label="Notas" fullWidth multiline rows={2} value={tunnelForm.notes || ''}
                onChange={(e) => setTunnelForm({ ...tunnelForm, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTunnelDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => createTunnelMutation.mutate(tunnelForm)}
            disabled={createTunnelMutation.isPending || !tunnelForm.name || !tunnelForm.device_a_id || !tunnelForm.device_b_id}
          >
            {createTunnelMutation.isPending ? <CircularProgress size={20} /> : 'Criar Túnel'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deploy Dialog */}
      <Dialog open={deployDialogOpen} onClose={() => setDeployDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Deploy: {selectedTunnel?.name}
          <Typography variant="body2" color="text.secondary">
            Aplicar configuração nos dispositivos MikroTik
          </Typography>
        </DialogTitle>
        <DialogContent>
          {!deployResult ? (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Esta ação irá configurar automaticamente os dois dispositivos MikroTik.
                Certifique-se de que ambos estão acessíveis.
              </Alert>

              <FormControlLabel
                control={
                  <Switch
                    checked={deployOpts.add_firewall_rules}
                    onChange={(e) => setDeployOpts({ ...deployOpts, add_firewall_rules: e.target.checked })}
                  />
                }
                label="Adicionar regras de firewall (permitir tráfego do túnel)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={deployOpts.add_routes}
                    onChange={(e) => setDeployOpts({ ...deployOpts, add_routes: e.target.checked })}
                  />
                }
                label="Adicionar rotas estáticas"
              />
              {deployOpts.add_routes && (
                <Box sx={{ ml: 4 }}>
                  <TextField
                    label="Redes para rotear via Dispositivo A" fullWidth margin="dense" size="small"
                    value={deployOpts.routes_device_a}
                    onChange={(e) => setDeployOpts({ ...deployOpts, routes_device_a: e.target.value })}
                    helperText="Redes separadas por vírgula. Ex: 192.168.1.0/24, 192.168.2.0/24"
                  />
                  <TextField
                    label="Redes para rotear via Dispositivo B" fullWidth margin="dense" size="small"
                    value={deployOpts.routes_device_b}
                    onChange={(e) => setDeployOpts({ ...deployOpts, routes_device_b: e.target.value })}
                    helperText="Redes separadas por vírgula"
                  />
                </Box>
              )}
            </Box>
          ) : (
            <Box>
              <Typography variant="h6" gutterBottom>Resultado do Deploy</Typography>

              {deployResult.errors?.length > 0 ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  Erros encontrados: {deployResult.errors.join(', ')}
                </Alert>
              ) : (
                <Alert severity="success" sx={{ mb: 2 }}>Deploy concluído com sucesso!</Alert>
              )}

              {['device_a', 'device_b'].map((dev) => (
                <Box key={dev} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">
                    {dev === 'device_a' ? selectedTunnel?.device_a_name : selectedTunnel?.device_b_name}
                  </Typography>
                  {deployResult[dev]?.map((step: any, i: number) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
                      {step.result?.success ? (
                        <CheckCircle color="success" fontSize="small" />
                      ) : (
                        <ErrorIcon color="error" fontSize="small" />
                      )}
                      <Typography variant="body2">{step.action}</Typography>
                      {!step.result?.success && (
                        <Typography variant="caption" color="error">
                          {step.result?.error}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!deployResult ? (
            <>
              <Button onClick={() => setDeployDialogOpen(false)}>Cancelar</Button>
              <Button variant="contained" color="warning" onClick={handleDeploy} startIcon={<PlayArrow />}>
                Executar Deploy
              </Button>
            </>
          ) : (
            <Button onClick={() => setDeployDialogOpen(false)}>Fechar</Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
