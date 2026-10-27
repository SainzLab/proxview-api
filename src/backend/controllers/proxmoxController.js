import db from '../config/database.js';
import axios from 'axios';
import https from 'https';

// ==========================================
// HELPER: LOGGING, FORMAT BYTES, & UPTIME
// ==========================================
export const addSystemLog = async (level, source, message) => {
  try {
    await db.query('INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)', [level, source, message]);
  } catch (error) {
    console.error('Gagal menulis log:', error);
  }
};

const formatBytes = (bytes) => {
  if (bytes === 0 || !bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatUptime = (seconds) => {
  if (!seconds) return '0h 0j 0m';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor(seconds % (3600 * 24) / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  return `${d}h ${h}j ${m}m`;
};

// ==========================================
// HELPER: BUAT INSTANCE AXIOS UNTUK PROXMOX
// ==========================================
const createProxmoxApi = (hostUrl, tokenId, tokenSecret) => {
  return axios.create({
    baseURL: hostUrl,
    timeout: 10000, // Timeout 10 detik
    headers: {
      'Authorization': `PVEAPIToken=${tokenId}=${tokenSecret}`
    },
    httpsAgent: new https.Agent({ rejectUnauthorized: false }) 
  });
};

// ==========================================
// 1. Ambil Semua Node Proxmox
// ==========================================
export const getProxmoxNodes = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, host_url as hostUrl, token_id as tokenId, status, latency, pve_version as pveVersion FROM proxmox_nodes');
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal memuat data Proxmox.' });
  }
};

// ==========================================
// 2. Tambah Node Proxmox
// ==========================================
export const createProxmoxNode = async (req, res) => {
  const { name, hostUrl, tokenId, tokenSecret } = req.body;
  try {
    await db.query(
      'INSERT INTO proxmox_nodes (name, host_url, token_id, token_secret) VALUES (?, ?, ?, ?)',
      [name, hostUrl, tokenId, tokenSecret]
    );
    await addSystemLog('INFO', 'PROXMOX API', `Server Proxmox baru ditambahkan: ${name}`);
    res.status(201).json({ success: true, message: 'Server Proxmox berhasil ditambahkan.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal menyimpan server Proxmox.' });
  }
};

// ==========================================
// 3. Update Node Proxmox
// ==========================================
export const updateProxmoxNode = async (req, res) => {
  const { id } = req.params;
  const { name, hostUrl, tokenId, tokenSecret } = req.body;
  try {
    if (tokenSecret && tokenSecret.trim() !== '') {
      await db.query(
        'UPDATE proxmox_nodes SET name=?, host_url=?, token_id=?, token_secret=? WHERE id=?',
        [name, hostUrl, tokenId, tokenSecret, id]
      );
    } else {
      await db.query(
        'UPDATE proxmox_nodes SET name=?, host_url=?, token_id=? WHERE id=?',
        [name, hostUrl, tokenId, id]
      );
    }
    await addSystemLog('INFO', 'PROXMOX API', `Konfigurasi Proxmox diperbarui: ${name}`);
    res.status(200).json({ success: true, message: 'Konfigurasi berhasil diperbarui.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal memperbarui konfigurasi.' });
  }
};

// ==========================================
// 4. Hapus Node Proxmox
// ==========================================
export const deleteProxmoxNode = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM proxmox_nodes WHERE id = ?', [id]);
    await addSystemLog('WARNING', 'PROXMOX API', `Server Proxmox dihapus dari sistem (ID: ${id})`);
    res.status(200).json({ success: true, message: 'Server Proxmox dihapus.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal menghapus server.' });
  }
};

// ==========================================
// 5. TEST KONEKSI KE API PROXMOX ASLI
// ==========================================
export const testProxmoxConnection = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM proxmox_nodes WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Server tidak ditemukan.' });

    const node = rows[0];
    const api = createProxmoxApi(node.host_url, node.token_id, node.token_secret);

    const startTime = Date.now();
    const response = await api.get('/api2/json/version');
    const latencyMs = Date.now() - startTime;
    const version = response.data.data.version; 

    await db.query('UPDATE proxmox_nodes SET status="TERHUBUNG", latency=?, pve_version=? WHERE id=?', [`${latencyMs} ms`, version, id]);
    await addSystemLog('INFO', 'PROXMOX API', `Uji Koneksi ${node.name} Sukses (v${version})`);
    
    res.status(200).json({ success: true, message: 'Koneksi berhasil.', latency: `${latencyMs} ms`, pveVersion: version });

  } catch (error) {
    const nodeName = error.config ? error.config.baseURL : `Node ID ${id}`;
    await db.query('UPDATE proxmox_nodes SET status="GAGAL", latency="-" WHERE id=?', [id]);
    await addSystemLog('ERROR', 'PROXMOX API', `Uji koneksi gagal ke ${nodeName}. Err: ${error.message}`);
    
    res.status(400).json({ success: false, message: 'Token ditolak atau Server Host tidak merespon.' });
  }
};

// ==========================================
// 6. TARIK DATA RESOURCES (VM, LXC, STORAGE) ASLI
// ==========================================
export const getProxmoxResources = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM proxmox_nodes WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Server tidak ditemukan.' });

    const node = rows[0];
    const api = createProxmoxApi(node.host_url, node.token_id, node.token_secret);

    const response = await api.get('/api2/json/cluster/resources');
    const resources = response.data.data;

    // Tambahkan properti "node: vm.node" agar ketahuan VM ini ada di server fisik mana
    const vms = resources.filter(r => r.type === 'qemu').map(vm => ({
      vmid: vm.vmid,
      name: vm.name,
      node: vm.node, // <--- IDENTIFIKATOR NODE
      status: vm.status,
      cpu_usage: vm.cpu ? (vm.cpu * 100).toFixed(1) + ' %' : '0.0 %',
      cpu_cores: vm.maxcpu || 0,
      ram_used: formatBytes(vm.mem || 0),
      ram_total: formatBytes(vm.maxmem || 0),
      ram_percentage: vm.maxmem ? ((vm.mem / vm.maxmem) * 100).toFixed(1) + ' %' : '0.0 %',
      disk_used: formatBytes(vm.disk || 0),
      disk_total: formatBytes(vm.maxdisk || 0),
      uptime: formatUptime(vm.uptime || 0),
      net_in: formatBytes(vm.netin || 0),
      net_out: formatBytes(vm.netout || 0)
    }));

    const lxcs = resources.filter(r => r.type === 'lxc').map(lxc => ({
      vmid: lxc.vmid,
      name: lxc.name,
      node: lxc.node, // <--- IDENTIFIKATOR NODE
      status: lxc.status,
      cpu_usage: lxc.cpu ? (lxc.cpu * 100).toFixed(1) + ' %' : '0.0 %',
      cpu_cores: lxc.maxcpu || 0,
      ram_used: formatBytes(lxc.mem || 0),
      ram_total: formatBytes(lxc.maxmem || 0),
      ram_percentage: lxc.maxmem ? ((lxc.mem / lxc.maxmem) * 100).toFixed(1) + ' %' : '0.0 %',
      disk_used: formatBytes(lxc.disk || 0),
      disk_total: formatBytes(lxc.maxdisk || 0),
      uptime: formatUptime(lxc.uptime || 0),
      net_in: formatBytes(lxc.netin || 0),
      net_out: formatBytes(lxc.netout || 0)
    }));

    const storages = resources.filter(r => r.type === 'storage').map(st => ({
      storage: st.storage,
      node: st.node, // <--- IDENTIFIKATOR NODE
      type: st.plugintype,
      status: st.status || (st.maxdisk && st.maxdisk > 0 ? 'available' : 'offline'),
      used: formatBytes(st.disk),
      total: formatBytes(st.maxdisk)
    }));

    res.status(200).json({ success: true, data: { vms, lxcs, storages } });

  } catch (error) {
    console.error('Proxmox API Error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal menarik data resource asli dari server Proxmox.' });
  }
};

// ==========================================
// 7. TARIK STATISTIK MENDALAM MULTI-NODE (CLUSTER)
// ==========================================
export const getProxmoxNodeStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM proxmox_nodes WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Server tidak ditemukan.' });

    const node = rows[0];
    const api = createProxmoxApi(node.host_url, node.token_id, node.token_secret);

    // Dapatkan list SEMUA node fisik di cluster
    const nodesRes = await api.get('/api2/json/nodes');
    if (!nodesRes.data.data || nodesRes.data.data.length === 0) {
       return res.status(404).json({ success: false, message: 'Node tidak ditemukan.' });
    }
    
    const physicalNodes = nodesRes.data.data;
    const results = [];

    for (const pNode of physicalNodes) {
      // Jika node fisik sudah ditandai offline oleh cluster, jangan panggil /status (agar tidak timeout 10 detik)
      if (pNode.status && String(pNode.status).toLowerCase() === 'offline') {
        results.push({
          node_name: pNode.node,
          status: 'offline',
          cpu_usage: '0.0 %',
          cpu_cores: pNode.maxcpu || 0,
          cpu_model: '-',
          ram_used: '0 B',
          ram_total: formatBytes(pNode.maxmem || 0),
          ram_percentage: '0.0 %',
          io_delay: '0.00 %',
          load_average: '-',
          uptime: '0h 0j 0m',
          network_traffic: { rx_in: '0 B/s', tx_out: '0 B/s' }
        });
        continue;
      }

      try {
        const statusRes = await api.get(`/api2/json/nodes/${pNode.node}/status`);
        const stats = statusRes.data.data;

        let rxTotal = 0;
        let txTotal = 0;
        try {
          const rrdRes = await api.get(`/api2/json/nodes/${pNode.node}/rrddata?timeframe=hour`);
          const rrdArray = rrdRes.data.data;
          
          if (rrdArray && rrdArray.length > 0) {
            for (let i = rrdArray.length - 1; i >= 0; i--) {
              if (rrdArray[i].netin !== undefined || rrdArray[i].netout !== undefined) {
                rxTotal = rrdArray[i].netin || 0;
                txTotal = rrdArray[i].netout || 0;
                break;
              }
            }
          }
        } catch (rrdErr) {
          console.error(`Gagal menarik RRD data untuk node ${pNode.node}:`, rrdErr.message);
        }

        results.push({
          node_name: pNode.node,
          status: pNode.status || 'online',
          cpu_usage: (stats.cpu * 100).toFixed(1) + ' %',
          cpu_cores: stats.cpuinfo.cpus,
          cpu_model: stats.cpuinfo.model,
          ram_used: formatBytes(stats.memory.used),
          ram_total: formatBytes(stats.memory.total),
          ram_percentage: ((stats.memory.used / stats.memory.total) * 100).toFixed(1) + ' %',
          io_delay: (stats.wait * 100).toFixed(2) + ' %',
          load_average: stats.loadavg.join(', '), 
          uptime: formatUptime(stats.uptime),
          network_traffic: {
            rx_in: formatBytes(rxTotal) + '/s',   
            tx_out: formatBytes(txTotal) + '/s'
          }
        });
      } catch (err) {
        console.error(`Gagal menarik status untuk node ${pNode.node}:`, err.message);
        results.push({
          node_name: pNode.node,
          status: 'offline',
          cpu_usage: '0.0 %',
          cpu_cores: pNode.maxcpu || 0,
          cpu_model: '-',
          ram_used: '0 B',
          ram_total: formatBytes(pNode.maxmem || 0),
          ram_percentage: '0.0 %',
          io_delay: '0.00 %',
          load_average: '-',
          uptime: '0h 0j 0m',
          network_traffic: { rx_in: '0 B/s', tx_out: '0 B/s' }
        });
      }
    }

    res.status(200).json({ success: true, data: results });

  } catch (error) {
    console.error('Proxmox Status Error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal menarik statistik mendalam dari server Proxmox.' });
  }
};
