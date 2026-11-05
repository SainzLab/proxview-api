import express from 'express';
import { runMobilePing, runMobileTraceroute, runMobileIpScan } from '../controllers/toolsController.js';

const router = express.Router();

router.post('/ping', runMobilePing);
router.post('/traceroute', runMobileTraceroute);
router.post('/ipscan', runMobileIpScan);

export default router;
