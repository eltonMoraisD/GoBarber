import express from 'express';
import path from 'path';
import * as Sentry from '@sentry/node';
import Youch from 'youch';
// ess import precisa vir antes das rotas caso contrario nao funciona
import 'express-async-errors';
import routes from './routes';
import sentryConfig from './config/sentry';

import './database';

class App {
  constructor() {
    this.server = express();

    Sentry.init(sentryConfig);

    this.middleware();
    this.router();
    this.exceptionHandler();
  }

  middleware() {
    // esse midle ware precisa ser o primeiro de todas
    this.server.use(Sentry.Handlers.requestHandler());

    this.server.use(express.json());
    this.server.use(
      '/files',
      express.static(path.resolve(__dirname, '..', 'tmp', 'uploads'))
    );
  }

  router() {
    this.server.use(routes);
    this.server.use(Sentry.Handlers.errorHandler());
  }

  exceptionHandler() {
    this.server.use(async (err, req, res, next) => {
      const errors = await new Youch(err, req).toJSON();

      return res.status(500).json({
        errors,
      });
    });
  }
}

export default new App().server;
