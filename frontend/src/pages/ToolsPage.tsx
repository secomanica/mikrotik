import React, { useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, TextField, Button, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Alert,
} from '@mui/material';
import { PlayArrow } from '@mui/icons-material';
import { toolsService } from '../services/routerosService';

function PingTool({ deviceId }: { deviceId: number }) {
  const [address, setAddress] = useState('');
  const [count, setCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleRun = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await toolsService.ping(deviceId, { address, count });
      setResult(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao executar ping');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Ping</Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="Endereço" value={address} onChange={(e) => setAddress(e.target.value)}
            fullWidth size="small" placeholder="8.8.8.8"
          />
          <TextField
            label="Count" type="number" value={count} onChange={(e) => setCount(Number(e.target.value))}
            sx={{ width: 120 }} size="small"
          />
          <Button
            variant="contained" startIcon={loading ? <CircularProgress size={16} /> : <PlayArrow />}
            onClick={handleRun} disabled={loading || !address}
          >
            Executar
          </Button>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        {result && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Seq</TableCell>
                  <TableCell>Host</TableCell>
                  <TableCell>TTL</TableCell>
                  <TableCell>Tempo</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(result) ? result : [result]).map((row: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{row.seq || i + 1}</TableCell>
                    <TableCell>{row.host || address}</TableCell>
                    <TableCell>{row.ttl || '-'}</TableCell>
                    <TableCell>{row.time || '-'}</TableCell>
                    <TableCell>{row.status || (row.time ? 'ok' : 'timeout')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}

function TracerouteTool({ deviceId }: { deviceId: number }) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleRun = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await toolsService.traceroute(deviceId, { address });
      setResult(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao executar traceroute');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Traceroute</Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="Endereço" value={address} onChange={(e) => setAddress(e.target.value)}
            fullWidth size="small" placeholder="8.8.8.8"
          />
          <Button
            variant="contained" startIcon={loading ? <CircularProgress size={16} /> : <PlayArrow />}
            onClick={handleRun} disabled={loading || !address}
          >
            Executar
          </Button>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        {result && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Hop</TableCell>
                  <TableCell>Endereço</TableCell>
                  <TableCell>Loss</TableCell>
                  <TableCell>Sent</TableCell>
                  <TableCell>Last</TableCell>
                  <TableCell>Avg</TableCell>
                  <TableCell>Best</TableCell>
                  <TableCell>Worst</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(result) ? result : [result]).map((row: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{row.hop || i + 1}</TableCell>
                    <TableCell>{row.address || '*'}</TableCell>
                    <TableCell>{row.loss ?? '-'}%</TableCell>
                    <TableCell>{row.sent ?? '-'}</TableCell>
                    <TableCell>{row.last ?? '-'}</TableCell>
                    <TableCell>{row.avg ?? '-'}</TableCell>
                    <TableCell>{row.best ?? '-'}</TableCell>
                    <TableCell>{row.worst ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default function ToolsPage() {
  const { deviceId } = useParams();
  const location = useLocation();
  const id = Number(deviceId);
  const tool = location.pathname.split('/').pop();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Ferramentas</Typography>
      {tool === 'ping' && <PingTool deviceId={id} />}
      {tool === 'traceroute' && <TracerouteTool deviceId={id} />}
    </Box>
  );
}
