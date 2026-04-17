import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, CircularProgress, Tooltip,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { userService } from '../services/authService';
import type { User, UserCreate, UserRole } from '../types/auth';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  read_write: 'Leitura/Escrita',
  read_only: 'Somente Leitura',
};

const roleColors: Record<string, 'error' | 'warning' | 'default'> = {
  admin: 'error',
  read_write: 'warning',
  read_only: 'default',
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserCreate>({
    username: '', email: '', full_name: '', password: '', role: 'read_only',
  });

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: userService.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: UserCreate) => userService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); handleClose(); },
  });

  const handleClose = () => {
    setDialogOpen(false);
    setEditUser(null);
    setForm({ username: '', email: '', full_name: '', password: '', role: 'read_only' });
  };

  const handleSubmit = () => {
    if (editUser) {
      userService.update(editUser.id, {
        email: form.email,
        full_name: form.full_name,
        role: form.role as UserRole,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['users'] });
        handleClose();
      });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (user: User) => {
    setEditUser(user);
    setForm({ username: user.username, email: user.email, full_name: user.full_name, password: '', role: user.role });
    setDialogOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Usuários</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
          Novo Usuário
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Usuário</TableCell>
              <TableCell>Nome</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Permissão</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Criado em</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} align="center"><CircularProgress /></TableCell></TableRow>
            ) : users?.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell fontWeight={600}>{user.username}</TableCell>
                <TableCell>{user.full_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip size="small" label={roleLabels[user.role]} color={roleColors[user.role]} />
                </TableCell>
                <TableCell>
                  <Chip size="small" label={user.is_active ? 'Ativo' : 'Inativo'} color={user.is_active ? 'success' : 'default'} />
                </TableCell>
                <TableCell>{new Date(user.created_at).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => handleEdit(user)}><Edit /></IconButton>
                  </Tooltip>
                  <Tooltip title="Desativar">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => { if (confirm('Desativar usuário?')) userService.remove(user.id).then(() => queryClient.invalidateQueries({ queryKey: ['users'] })); }}
                    >
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Usuário" fullWidth margin="normal" value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            disabled={!!editUser} required
          />
          <TextField
            label="Nome Completo" fullWidth margin="normal" value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })} required
          />
          <TextField
            label="Email" type="email" fullWidth margin="normal" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required
          />
          {!editUser && (
            <TextField
              label="Senha" type="password" fullWidth margin="normal" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} required
            />
          )}
          <TextField
            label="Permissão" select fullWidth margin="normal" value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
          >
            <MenuItem value="admin">Administrador</MenuItem>
            <MenuItem value="read_write">Leitura/Escrita</MenuItem>
            <MenuItem value="read_only">Somente Leitura</MenuItem>
          </TextField>
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
