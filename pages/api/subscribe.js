import { addSubscription, removeSubscription } from '../../utils/subscriptions';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { subscription } = req.body;
    if (!subscription?.endpoint) {
      return res.status(400).json({ error: 'Subscription inválida' });
    }
    addSubscription(subscription);
    return res.status(201).json({ message: 'Inscrito com sucesso' });
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint obrigatório' });
    removeSubscription(endpoint);
    return res.status(200).json({ message: 'Inscrição removida' });
  }

  res.setHeader('Allow', ['POST', 'DELETE']);
  return res.status(405).json({ error: 'Método não permitido' });
}
