import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, CircularProgress, Tooltip, Card, CardContent, Grid,
  Alert,
} from '@mui/material';
import {
  Add, Edit, Delete, Visibility, Business, Router, VpnKey,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { clientService } from '../services/clientService';
import type { Client, ClientCreate } from '../types/client';

export default function ClientsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, isAdmin } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientCreate>({
    name: '', code: '', contact_name: '', contact_email: '', contact_phone: '', address: '', notes: '',
  });

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: clientService.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: ClientCreate) => clientService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); handleClose(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => clientService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  const handleClose = () => {
    setDialogOpen(false);
    setEditClient(null);
    setForm({ name: '', code: '', contact_name: '', contact_email: '', contact_phone: '', address: '', notes: '' });
  };

  const handleSubmit = () => {
    if (editClient) {
      clientService.update(editClient.id, form).then(() => {
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        handleClose();
      });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (client: Client) => {
    setEditClient(client);
    setForm({
      name: client.name,
      code: client.code,
      contact_name: client.contact_name || '',
      contact_email: client.contact_email || '',
      contact_phone: client.contact_phone || '',
      address: client.address || '',
      notes: client.notes || '',
    });
    setDialogOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Clientes</Typography>
        {canWrite && (
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
            Novo Cliente
          </Button>
        )}
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : clients && clients.length > 0 ? (
        <Grid container spacing={2}>
          {clients.map((client) => (
            <Grid item xs={12} sm={6} md={4} key={client.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                }}
                onClick={() => navigate(`/clients/${client.id}`)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Business color="primary" />
                      <Typography variant="h6" fontSize="1rem" fontWeight={600}>
                        {client.name}
                      </Typography>
                    </Box>
                    <Chip size="small" label={client.code} variant="outlined" />
                  </Box>

                  {client.contact_name && (
                    <Typography variant="body2" color="text.secondary">{client.contact_name}</Typography>
                  )}
                  {client.contact_email && (
                    <Typography variant="body2" color="text.secondary">{client.contact_email}</Typography>
                  )}
                  {client.contact_phone && (
                    <Typography variant="body2" color="text.secondary">{client.contact_phone}</Typography>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Chip
                      size="small"
                      icon={<Router />}
                      label={`${client.device_count || 0} dispositivo(s)`}
                      color="primary"
                      variant="outlined"
                    />
                    <Chip
                      size="small"
                      label={client.is_active ? 'Ativo' : 'Inativo'}
                      color={client.is_active ? 'success' : 'default'}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, gap: 0.5 }}>
                    {canWrite && (
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEdit(client); }}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {isAdmin && (
                      <Tooltip title="Remover">
                        <IconButton
                          size="small" color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Remover cliente? Todos os dispositivos devem ser removidos antes.'))
                              deleteMutation.mutate(client.id);
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info">Nenhum cliente cadastrado.</Alert>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editClient ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Nome do Cliente" fullWidth margin="normal" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus
          />
          <TextField
            label="Código (identificador curto)" fullWidth margin="normal" value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required
            helperText="Ex: CLI001, EMPRESA-A"
          />
          <TextField
            label="Nome do Contato" fullWidth margin="normal" value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
          />
          <TextField
            label="Email do Contato" type="email" fullWidth margin="normal" value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          />
          <TextField
            label="Telefone" fullWidth margin="normal" value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
          />
          <TextField
            label="Endereço" fullWidth margin="normal" value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
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
    </Box>
  );
}
