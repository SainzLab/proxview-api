import express from 'express';
import { runMobilePing, runMobileTraceroute, runMobileIpScan } from '../controllers/toolsController.js';

const router = express.Router();

// Endpoint Mobile Network Tools (JSON Response utuh, menggunakan child_process.exec)
router.post('/ping', runMobilePing);
router.post('/traceroute', runMobileTraceroute);
router.post('/ipscan', runMobileIpScan);

export default router;
