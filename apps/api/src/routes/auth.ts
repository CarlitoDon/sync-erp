import { Router } from 'express';
import { AuthController } from '../modules/auth/auth.controller';

// We should move /me logic to Controller too.
// I'll update Controller to include 'me'.

const router = Router();
const controller = new AuthController();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/logout', controller.logout);
router.get('/me', controller.me);

export { router as authRouter };
