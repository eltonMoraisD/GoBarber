import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import authConfig from '../../config/auth';

export default async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      status: 'fail',
      message: 'Token not provided',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = await promisify(jwt.verify)(token, authConfig.secret);

    req.userId = decoded.id; //  inclui o id na requisiçao quando o usuario faz o login

    return next();
  } catch (err) {
    return res.status(401).json({
      status: 'fail',
      message: 'Token is invalid',
    });
  }
};
