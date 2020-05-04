import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore } from 'date-fns';
import Appointment from '../models/Appointment';
import User from '../models/User';

class AppointmentController {
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
    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!isProvider) {
      return res.status(401).json({
        error: 'You can only create appointments with providers',
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

    return res.status(200).json(appointments);
  }
}

export default new AppointmentController();
