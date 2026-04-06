import React, { useState, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Switch, FormControlLabel, CircularProgress, Alert, Chip,
  Tooltip, InputAdornment, Toolbar,
} from '@mui/material';
import {
  Add, Edit, Delete, Refresh, Search, CheckCircle, Cancel,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useRouterOS } from '../hooks/useRouterOS';

export default function GenericResourcePage() {
  const { deviceId } = useParams();
  const location = useLocation();
  const { canWrite } = useAuth();
  const id = Number(deviceId);

  // Extract ROS path from URL: /devices/:id/ros/ip/firewall/filter -> ip/firewall/filter
  const rosPath = location.pathname.replace(`/devices/${deviceId}/ros/`, '');

  const { data, isLoading, error, refetch, create, update, remove, isCreating } = useRouterOS(id, rosPath);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Auto-detect columns from data
  const columns = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const allKeys = new Set<string>();
    data.slice(0, 5).forEach((item: any) => {
      Object.keys(item).forEach((key) => {
        if (!key.startsWith('.')) allKeys.add(key);
      });
    });
    // Prioritize common columns
    const priority = ['name', 'address', 'interface', 'chain', 'action', 'src-address', 'dst-address',
      'protocol', 'dst-port', 'gateway', 'target', 'comment', 'disabled', 'dynamic', 'running', 'type', 'status'];
    const sorted = [...allKeys].sort((a, b) => {
      const ai = priority.indexOf(a);
      const bi = priority.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
    return sorted.slice(0, 12); // Limit to 12 columns
  }, [data]);

  // Filter data by search
  const filteredData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((item: any) =>
      Object.values(item).some((val) => String(val).toLowerCase().includes(q))
    );
  }, [data, searchQuery]);

  const handleAdd = () => {
    setEditItem(null);
    setFormData({});
    setDialogOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditItem(item);
    const fd: Record<string, any> = {};
    Object.entries(item).forEach(([key, value]) => {
      if (!key.startsWith('.')) fd[key] = value;
    });
    setFormData(fd);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      // Clean empty values
      const cleanData: Record<string, any> = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== '' && value !== undefined && value !== null) {
          cleanData[key] = value;
        }
      });

      if (editItem) {
        await update({ id: editItem['.id'], data: cleanData });
      } else {
        await create(cleanData);
      }
      setDialogOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao salvar');
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      await remove(itemId);
      setDeleteConfirm(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao remover');
    }
  };

  const renderCellValue = (value: any) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Chip size="small" label="sim" color="success" variant="outlined" />
      ) : (
        <Chip size="small" label="não" color="default" variant="outlined" />
      );
    }
    if (value === 'true') return <Chip size="small" label="sim" color="success" variant="outlined" />;
    if (value === 'false') return <Chip size="small" label="não" color="default" variant="outlined" />;
    return String(value ?? '-');
  };

  // Handle single-object resources (like system/identity, ip/dns)
  const isSingleObject = data && !Array.isArray(data) && typeof data === 'object';

  if (isSingleObject) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">{rosPath.replace(/\//g, ' > ')}</Typography>
          <Button startIcon={<Refresh />} onClick={() => refetch()}>Atualizar</Button>
        </Box>
        <Card component={Paper} sx={{ p: 2 }}>
          <Table size="small">
            <TableBody>
              {Object.entries(data).filter(([k]) => !k.startsWith('.')).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell sx={{ fontWeight: 600, width: '30%' }}>{key}</TableCell>
                  <TableCell>{renderCellValue(value)}</TableCell>
                  {canWrite && (
                    <TableCell width={100}>
                      <IconButton size="small" onClick={() => {
                        setEditItem(data);
                        setFormData({ [key]: value });
                        setDialogOpen(true);
                      }}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Editar</DialogTitle>
          <DialogContent>
            {Object.entries(formData).map(([key, value]) => (
              <TextField
                key={key}
                label={key}
                fullWidth
                margin="normal"
                value={value ?? ''}
                onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
              />
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button variant="contained" onClick={async () => {
              try {
                // For single objects, use PATCH on the resource directly
                await update({ id: '', data: formData });
                setDialogOpen(false);
              } catch (err: any) {
                alert(err.response?.data?.error || 'Erro ao salvar');
              }
            }}>Salvar</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">{rosPath.replace(/\//g, ' > ')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Refresh />} onClick={() => refetch()}>Atualizar</Button>
          {canWrite && (
            <Button variant="contained" startIcon={<Add />} onClick={handleAdd}>Novo</Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Erro: {(error as Error).message}</Alert>}

      <Paper>
        <Toolbar sx={{ gap: 1 }}>
          <TextField
            size="small"
            placeholder="Pesquisar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
            }}
            sx={{ minWidth: 300 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            {filteredData.length} registro(s)
          </Typography>
        </Toolbar>

        <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell key={col} sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                    {col.replace(/-/g, ' ')}
                  </TableCell>
                ))}
                {canWrite && <TableCell align="right" sx={{ fontWeight: 700 }}>Ações</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} align="center">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item: any, index: number) => (
                  <TableRow
                    key={item['.id'] || index}
                    hover
                    sx={{
                      opacity: item.disabled === 'true' || item.disabled === true ? 0.5 : 1,
                    }}
                  >
                    {columns.map((col) => (
                      <TableCell key={col}>{renderCellValue(item[col])}</TableCell>
                    ))}
                    {canWrite && (
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => handleEdit(item)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {!item.dynamic && (
                          <Tooltip title="Remover">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteConfirm(item['.id'])}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editItem ? 'Editar Registro' : 'Novo Registro'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            {(editItem ? Object.keys(formData) : columns).filter(k => !['dynamic', 'running', '.id', 'invalid'].includes(k)).map((key) => {
              const value = formData[key] ?? '';
              if (typeof value === 'boolean' || value === 'true' || value === 'false') {
                return (
                  <FormControlLabel
                    key={key}
                    control={
                      <Switch
                        checked={value === true || value === 'true'}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.checked.toString() })}
                      />
                    }
                    label={key.replace(/-/g, ' ')}
                  />
                );
              }
              return (
                <TextField
                  key={key}
                  label={key.replace(/-/g, ' ')}
                  fullWidth
                  margin="dense"
                  size="small"
                  value={value}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                />
              );
            })}
          </Box>
          {!editItem && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Adicione campos extras separados por vírgula:
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="campo1, campo2, campo3"
                margin="dense"
                onBlur={(e) => {
                  const extras = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  extras.forEach((key) => {
                    if (!(key in formData)) setFormData(prev => ({ ...prev, [key]: '' }));
                  });
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={isCreating}>
            {isCreating ? <CircularProgress size={20} /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <Typography>Tem certeza que deseja remover este registro?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
            Remover
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Needed for single-object rendering
function Card(props: any) {
  const { component: Component = 'div', ...rest } = props;
  return <Component {...rest} />;
}
