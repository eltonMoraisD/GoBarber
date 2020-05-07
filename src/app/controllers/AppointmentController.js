import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';
import Appointment from '../models/Appointment';
import User from '../models/User';
import File from '../models/File';
import Notification from '../schema/Notification';
import Queue from '../../lib/Queue';
import CancelationMail from '../jobs/CancelationMail';

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const appointments = await Appointment.findAll({
      where: { user_id: req.userId, cancelled_at: null },
      order: ['date'],
      attributes: ['id', 'date'],
      limit: 20,
      offset: (page - 1) * 20,
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url'],
            },
          ],
        },
      ],
    });

    return res.json(appointments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails' });
    }

    const { provider_id, date } = req.body;

    /*
     *Check if provider_id is a provider
     */
    const checkIsProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!checkIsProvider) {
      return res.status(401).json({
        error: 'You can only create appointments with providers',
      });
    }

    // impedir o provider d fazer um agendamento para ele mesmo
    const isProvider = await User.findOne({
      where: { id: req.userId, provider: true },
    });

    if (isProvider) {
      return res.status(400).json({
        message: 'You are a provider, dont get crazy kkkkkkk',
      });
    }

    const hourStart = startOfHour(parseISO(date));

    /* testa se a data que o usuario passou esta antes da data atual, ou seja,
     * uma data que ja passou
     */
    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({
        message: 'Past dates are not permitted',
      });
    }

    /*
     * Verificar se o prestador de serviço ja tem um agendamento marcado para a data que,
     * o usuario digitou
     */

    const checkAvailability = await Appointment.findOne({
      where: {
        provider_id,
        cancelled_at: null,
        date: hourStart,
      },
    });

    if (checkAvailability) {
      return res.status(400).json({
        message: 'Appointment date is not available',
      });
    }

    const appointments = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date: hourStart,
    });

    /**
     * Notificar prestador de serviço
     */
    const user = await User.findByPk(req.userId);
    const formattedDate = format(
      hourStart,
      "'dia' dd 'de' MMMM', ás' H:mm'h'",
      { locale: pt }
    );

    await Notification.create({
      content: `Novo agendamento de ${user.name} para o  ${formattedDate}`,
      user: provider_id,
    });

    return res.status(200).json(appointments);
  }

  // cancelar agendamento
  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });

    if (appointment.user_id !== req.userId) {
      return res.status(401).json({
        message: " Yo don't have  permission to cancel this appointment.",
      });
    }

    /* so pode fazer o cancelamento do agendamento se tiver a 2h do ou mais do horario marcado
     * se a diferença for < 2h entao o usuario nao pode cancelar o agendamento
     * agendamento = 4h   agora sao=2h  result = falta 2h entao pode cancelar
     * agendamento = 4h   agora sao=3h  result = falta 1h entao nao pode cancelar
     */
    const dateWithSub = subHours(appointment.date, 2);

    if (isBefore(dateWithSub, new Date())) {
      return res.status(401).json({
        status: 'fail',
        message: 'Error, you can only cancel appointments 2 hours in advance.',
      });
    }

    // setar a data do cancelamento do campo cancelled_at da db
    appointment.cancelled_at = new Date();

    // salvar  a data do cancelamento nesse campo da db
    await appointment.save();

    await Queue.add(CancelationMail.key, {
      appointment,
    });

    return res.json(appointment);
  }
}

export default new AppointmentController();
