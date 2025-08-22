import { Router } from 'express';
import { firebaseWebConfig } from '../firebase.js';

const router = Router();

router.get('/public', (_req, res) => {
  res.json({ firebase: firebaseWebConfig });
});

export default router;


