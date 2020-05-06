import Notification from '../schema/Notification';
import User from '../models/User';

class NotificationController {
  async index(req, res) {
    // Verificar se usuario logado é um prestador de serviço
    const checkIsProvider = await User.findOne({
      where: { id: req.userId, provider: true },
    });

    if (!checkIsProvider) {
      return res.status(401).json({
        error: 'Only providers can Load notifications',
      });
    }

    const notifications = await Notification.find({
      user: req.userId,
    })
      .sort({ createdAt: 'desc' })
      .limit(20);

    return res.json(notifications);
  }
}

export default new NotificationController();
