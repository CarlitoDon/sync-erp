import { Router } from 'express';
import { UserController } from '../modules/user/user.controller';

export const userRouter = Router();
const controller = new UserController();

// GET /api/users - List users (in current company context)
userRouter.get('/', controller.listCompanyMembers);

// POST /api/users - Invite/Create user is confusing in old route, mapping to 'invite'
userRouter.post('/', controller.invite);

// POST /api/users/:userId/assign - Assign user to current company
userRouter.post('/:userId/assign', controller.assign);
