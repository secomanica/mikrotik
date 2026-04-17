import React from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  Drawer, Box, Toolbar, List, ListItemButton, ListItemIcon, ListItemText,
  Divider, Typography, Collapse,
} from '@mui/material';
import {
  Dashboard, Router, People, Security, Language, SwapHoriz, Storage,
  Speed, Dns, Wifi, VpnKey, Build, Assessment, Description,
  ExpandLess, ExpandMore, Fireplace, Settings, History, Business,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';

interface SidebarProps {
  drawerWidth: number;
  mobileOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  children?: NavItem[];
  requireDevice?: boolean;
}

export default function Sidebar({ drawerWidth, mobileOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { deviceId } = useParams();
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const mainNavItems: NavItem[] = [
    { label: 'Dashboard', icon: <Dashboard />, path: '/' },
    { label: 'Clientes', icon: <Business />, path: '/clients' },
    { label: 'Dispositivos', icon: <Router />, path: '/devices' },
    ...(isAdmin ? [
      { label: 'Usuários', icon: <People />, path: '/users' },
      { label: 'Auditoria', icon: <History />, path: '/audit' },
    ] : []),
  ];

  const deviceNavItems: NavItem[] = deviceId ? [
    { label: 'Visão Geral', icon: <Assessment />, path: `/devices/${deviceId}/overview` },
    {
      label: 'Sistema', icon: <Settings />, path: '', children: [
        { label: 'Identidade', icon: <Dns />, path: `/devices/${deviceId}/ros/system/identity` },
        { label: 'Recursos', icon: <Speed />, path: `/devices/${deviceId}/ros/system/resource` },
        { label: 'Pacotes', icon: <Storage />, path: `/devices/${deviceId}/ros/system/package` },
        { label: 'Usuários', icon: <People />, path: `/devices/${deviceId}/ros/user` },
      ],
    },
    {
      label: 'IP', icon: <Language />, path: '', children: [
        { label: 'Endereços', icon: <Language />, path: `/devices/${deviceId}/ros/ip/address` },
        { label: 'Rotas', icon: <SwapHoriz />, path: `/devices/${deviceId}/ros/ip/route` },
        { label: 'DNS', icon: <Dns />, path: `/devices/${deviceId}/ros/ip/dns` },
        { label: 'DHCP Server', icon: <Storage />, path: `/devices/${deviceId}/ros/ip/dhcp-server` },
        { label: 'DHCP Client', icon: <Storage />, path: `/devices/${deviceId}/ros/ip/dhcp-client` },
        { label: 'Pool', icon: <Storage />, path: `/devices/${deviceId}/ros/ip/pool` },
        { label: 'ARP', icon: <SwapHoriz />, path: `/devices/${deviceId}/ros/ip/arp` },
      ],
    },
    {
      label: 'Firewall', icon: <Security />, path: '', children: [
        { label: 'Filter', icon: <Fireplace />, path: `/devices/${deviceId}/ros/ip/firewall/filter` },
        { label: 'NAT', icon: <SwapHoriz />, path: `/devices/${deviceId}/ros/ip/firewall/nat` },
        { label: 'Mangle', icon: <Build />, path: `/devices/${deviceId}/ros/ip/firewall/mangle` },
        { label: 'Raw', icon: <Security />, path: `/devices/${deviceId}/ros/ip/firewall/raw` },
        { label: 'Address Lists', icon: <Description />, path: `/devices/${deviceId}/ros/ip/firewall/address-list` },
        { label: 'Conexões', icon: <SwapHoriz />, path: `/devices/${deviceId}/ros/ip/firewall/connection` },
      ],
    },
    {
      label: 'Interfaces', icon: <Wifi />, path: '', children: [
        { label: 'Todas', icon: <Wifi />, path: `/devices/${deviceId}/ros/interface` },
        { label: 'Ethernet', icon: <Wifi />, path: `/devices/${deviceId}/ros/interface/ethernet` },
        { label: 'VLAN', icon: <Wifi />, path: `/devices/${deviceId}/ros/interface/vlan` },
        { label: 'Bridge', icon: <Wifi />, path: `/devices/${deviceId}/ros/interface/bridge` },
        { label: 'Bonding', icon: <Wifi />, path: `/devices/${deviceId}/ros/interface/bonding` },
        { label: 'WireGuard', icon: <VpnKey />, path: `/devices/${deviceId}/ros/interface/wireguard` },
      ],
    },
    {
      label: 'Roteamento', icon: <SwapHoriz />, path: '', children: [
        { label: 'OSPF', icon: <SwapHoriz />, path: `/devices/${deviceId}/ros/routing/ospf/instance` },
        { label: 'BGP', icon: <SwapHoriz />, path: `/devices/${deviceId}/ros/routing/bgp/connection` },
      ],
    },
    {
      label: 'Filas', icon: <Speed />, path: '', children: [
        { label: 'Simple Queues', icon: <Speed />, path: `/devices/${deviceId}/ros/queue/simple` },
        { label: 'Queue Tree', icon: <Speed />, path: `/devices/${deviceId}/ros/queue/tree` },
      ],
    },
    {
      label: 'VPN', icon: <VpnKey />, path: '', children: [
        { label: 'IPSec Peers', icon: <VpnKey />, path: `/devices/${deviceId}/ros/ip/ipsec/peer` },
        { label: 'IPSec Policies', icon: <VpnKey />, path: `/devices/${deviceId}/ros/ip/ipsec/policy` },
        { label: 'WireGuard Peers', icon: <VpnKey />, path: `/devices/${deviceId}/ros/interface/wireguard/peers` },
        { label: 'L2TP Server', icon: <VpnKey />, path: `/devices/${deviceId}/ros/interface/l2tp-server/server` },
        { label: 'SSTP Server', icon: <VpnKey />, path: `/devices/${deviceId}/ros/interface/sstp-server/server` },
        { label: 'OpenVPN Server', icon: <VpnKey />, path: `/devices/${deviceId}/ros/interface/ovpn-server/server` },
      ],
    },
    {
      label: 'Ferramentas', icon: <Build />, path: '', children: [
        { label: 'Ping', icon: <Build />, path: `/devices/${deviceId}/tools/ping` },
        { label: 'Traceroute', icon: <Build />, path: `/devices/${deviceId}/tools/traceroute` },
        { label: 'Netwatch', icon: <Build />, path: `/devices/${deviceId}/ros/tool/netwatch` },
      ],
    },
    { label: 'Logs', icon: <Description />, path: `/devices/${deviceId}/logs` },
    { label: 'Arquivos', icon: <Storage />, path: `/devices/${deviceId}/ros/file` },
  ] : [];

  const renderNavItem = (item: NavItem, depth = 0) => {
    if (item.children) {
      const key = item.label;
      const isOpen = openSections[key] ?? false;
      return (
        <React.Fragment key={key}>
          <ListItemButton onClick={() => toggleSection(key)} sx={{ pl: 2 + depth * 2 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.875rem' }} />
            {isOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <List disablePadding>
              {item.children.map((child) => renderNavItem(child, depth + 1))}
            </List>
          </Collapse>
        </React.Fragment>
      );
    }

    return (
      <ListItemButton
        key={item.path}
        selected={location.pathname === item.path}
        onClick={() => { navigate(item.path); onClose(); }}
        sx={{ pl: 2 + depth * 2 }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
        <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.875rem' }} />
      </ListItemButton>
    );
  };

  const drawerContent = (
    <Box>
      <Toolbar>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
          MikroTik
        </Typography>
      </Toolbar>
      <Divider />
      <List>{mainNavItems.map((item) => renderNavItem(item))}</List>
      {deviceNavItems.length > 0 && (
        <>
          <Divider />
          <Typography variant="caption" sx={{ pl: 2, pt: 1, display: 'block', color: 'text.secondary' }}>
            DISPOSITIVO
          </Typography>
          <List>{deviceNavItems.map((item) => renderNavItem(item))}</List>
        </>
      )}
    </Box>
  );

  return (
    <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth } }}
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth } }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
}
