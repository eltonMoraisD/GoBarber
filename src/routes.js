import { Router } from 'express';
import User from './app/models/User';

const routes = new Router();

routes.get('/', async (req, res) => {
  const user = await User.create({
    name: 'Elton',
    email: 'elton@gmail.com',
    password_hash: '12445323523523523523523',
  });
  res.json(user);
});

export default routes;
