import webpush from 'web-push';
import { loadSubscriptions, loadKnownIpoIds, saveKnownIpoIds } from '../../utils/subscriptions';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { ipos, manual } = req.body;

  if (!ipos || !Array.isArray(ipos)) {
    return res.status(400).json({ error: 'Lista de IPOs obrigatória' });
  }

  const subscriptions = loadSubscriptions();
  if (subscriptions.length === 0) {
    return res.status(200).json({ sent: 0, message: 'Nenhum inscrito' });
  }

  let newIpos = ipos;

  if (!manual) {
    const knownIds = loadKnownIpoIds();
    newIpos = ipos.filter((ipo) => !knownIds.includes(ipo.id));
    if (newIpos.length === 0) {
      return res.status(200).json({ sent: 0, message: 'Nenhum IPO novo' });
    }
    saveKnownIpoIds([...knownIds, ...newIpos.map((i) => i.id)]);
  }

  const notifications = newIpos.map((ipo) => ({
    title: `🚀 Novo IPO: ${ipo.company}`,
    body: `${ipo.sector} · ${ipo.date} · ${ipo.priceRange}`,
    tag: `ipo-${ipo.id}`,
    url: '/ipo-tracker',
    ipoId: ipo.id,
  }));

  let sent = 0;
  const failed = [];

  for (const sub of subscriptions) {
    for (const notif of notifications) {
      try {
        await webpush.sendNotification(sub, JSON.stringify(notif));
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          failed.push(sub.endpoint);
        }
      }
    }
  }

  return res.status(200).json({ sent, newIpos: newIpos.length, failed: failed.length });
}
