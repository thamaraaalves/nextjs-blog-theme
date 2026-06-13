import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

const SECTORS = [
  'Todos',
  'Tecnologia',
  'Financeiro',
  'Saúde',
  'Energia',
  'Varejo',
  'Industrial',
  'Agronegócio',
  'Imobiliário',
  'Infraestrutura',
  'Telecomunicações',
  'Consumo',
  'Outros',
];

const STATUS_CONFIG = {
  upcoming: { label: 'Em breve', bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  open: { label: 'Aberto', bg: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  priced: { label: 'Precificado', bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  withdrawn: { label: 'Cancelado', bg: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  closed: { label: 'Encerrado', bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

const SECTOR_ICONS = {
  Tecnologia: '💻',
  Financeiro: '🏦',
  Saúde: '⚕️',
  Energia: '⚡',
  Varejo: '🛍️',
  Industrial: '🏭',
  Agronegócio: '🌾',
  Imobiliário: '🏢',
  Infraestrutura: '🔧',
  Telecomunicações: '📡',
  Consumo: '🛒',
  Outros: '📋',
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function formatDate(dateStr) {
  if (!dateStr) return '–';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function daysUntil(dateStr) {
  try {
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
    if (diff < 0) return null;
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    return `em ${diff} dias`;
  } catch {
    return null;
  }
}

export default function IPOTracker() {
  const [ipos, setIpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSectors, setSelectedSectors] = useState(['Todos']);
  const [selectedStatus, setSelectedStatus] = useState('todos');
  const [search, setSearch] = useState('');
  const [notifStatus, setNotifStatus] = useState('idle');
  const [dataSource, setDataSource] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [notifMessage, setNotifMessage] = useState('');
  const refreshTimer = useRef(null);

  const fetchIPOs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ipos');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const ipoList = data.ipos || [];
      setIpos(ipoList);
      setDataSource(data.source);
      setSourceNote(data.sourceNote || '');
      setLastUpdated(new Date(data.updatedAt));

      if (data.source === 'live' && ipoList.length > 0) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ipos: ipoList }),
        }).catch(() => {});
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkNotificationStatus = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotifStatus('unsupported');
      return;
    }
    const permission = Notification.permission;
    if (permission === 'denied') {
      setNotifStatus('denied');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setSubscription(sub);
        setNotifStatus('enabled');
      } else {
        setNotifStatus('idle');
      }
    } catch {
      setNotifStatus('idle');
    }
  }, []);

  useEffect(() => {
    fetchIPOs();
    checkNotificationStatus();

    refreshTimer.current = setInterval(() => fetchIPOs(true), 5 * 60 * 1000);
    return () => clearInterval(refreshTimer.current);
  }, [fetchIPOs, checkNotificationStatus]);

  const enableNotifications = async () => {
    setNotifStatus('requesting');
    setNotifMessage('');
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setNotifStatus('denied');
        setNotifMessage('Permissão negada. Habilite nas configurações do browser.');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      });

      setSubscription(sub);
      setNotifStatus('enabled');
      setNotifMessage('Notificações ativadas! Você receberá alertas de novos IPOs.');
    } catch (e) {
      console.error(e);
      setNotifStatus('idle');
      setNotifMessage('Erro ao ativar notificações: ' + e.message);
    }
  };

  const disableNotifications = async () => {
    try {
      if (subscription) {
        await subscription.unsubscribe();
        await fetch('/api/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        setSubscription(null);
      }
      setNotifStatus('idle');
      setNotifMessage('Notificações desativadas.');
    } catch (e) {
      setNotifMessage('Erro ao desativar: ' + e.message);
    }
  };

  const sendTestNotification = async () => {
    if (ipos.length === 0) return;
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ipos: [ipos[0]], manual: true }),
    });
    setNotifMessage('Notificação de teste enviada!');
    setTimeout(() => setNotifMessage(''), 3000);
  };

  const toggleSector = (sector) => {
    if (sector === 'Todos') {
      setSelectedSectors(['Todos']);
      return;
    }
    setSelectedSectors((prev) => {
      const withoutAll = prev.filter((s) => s !== 'Todos');
      if (withoutAll.includes(sector)) {
        const next = withoutAll.filter((s) => s !== sector);
        return next.length === 0 ? ['Todos'] : next;
      }
      return [...withoutAll, sector];
    });
  };

  const filteredIpos = ipos.filter((ipo) => {
    const sectorMatch =
      selectedSectors.includes('Todos') || selectedSectors.includes(ipo.sector);
    const statusMatch = selectedStatus === 'todos' || ipo.status === selectedStatus;
    const searchMatch =
      !search ||
      ipo.company.toLowerCase().includes(search.toLowerCase()) ||
      ipo.symbol?.toLowerCase().includes(search.toLowerCase()) ||
      ipo.sector?.toLowerCase().includes(search.toLowerCase());
    return sectorMatch && statusMatch && searchMatch;
  });

  const notifButtonConfig = {
    idle: { label: 'Ativar notificações', icon: '🔔', action: enableNotifications, cls: 'bg-blue-600 hover:bg-blue-700 text-white' },
    requesting: { label: 'Aguardando...', icon: '⏳', action: null, cls: 'bg-gray-400 text-white cursor-not-allowed' },
    enabled: { label: 'Notificações ativas', icon: '🔔', action: null, cls: 'bg-green-600 text-white' },
    denied: { label: 'Permissão negada', icon: '🔕', action: null, cls: 'bg-red-500 text-white' },
    unsupported: { label: 'Não suportado', icon: '🚫', action: null, cls: 'bg-gray-400 text-white cursor-not-allowed' },
  };

  const nb = notifButtonConfig[notifStatus] || notifButtonConfig.idle;

  return (
    <>
      <Head>
        <title>IPO Tracker Brasil</title>
        <meta name="description" content="Acompanhe os próximos IPOs da B3 com alertas em tempo real" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1e40af" />
        <link rel="manifest" href="/manifest.json" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="text-3xl">📈</div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                  IPO Tracker Brasil
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Acompanhe os próximos IPOs da B3
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {notifStatus === 'enabled' ? (
                <>
                  <button
                    onClick={sendTestNotification}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Testar push
                  </button>
                  <button
                    onClick={disableNotifications}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white flex items-center gap-1.5"
                  >
                    <span>🔔</span> Ativo
                  </button>
                </>
              ) : (
                <button
                  onClick={nb.action || undefined}
                  disabled={!nb.action}
                  className={`text-sm px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${nb.cls}`}
                >
                  <span>{nb.icon}</span>
                  {nb.label}
                </button>
              )}
              <button
                onClick={() => fetchIPOs()}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5"
              >
                🔄 Atualizar
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
          {/* Notification message */}
          {notifMessage && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
              <span>ℹ️</span>
              {notifMessage}
            </div>
          )}

          {/* Source indicator */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  dataSource === 'live' ? 'bg-green-500' : 'bg-yellow-500'
                }`}
              />
              {dataSource === 'live' ? (
                <span>Dados ao vivo · br.investing.com</span>
              ) : (
                <span>{sourceNote || 'Dados demonstrativos'}</span>
              )}
            </div>
            {lastUpdated && (
              <span>Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </div>

          {/* Search + Status filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Buscar empresa, ticker ou setor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="py-2.5 px-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos os status</option>
              <option value="upcoming">Em breve</option>
              <option value="open">Aberto</option>
              <option value="priced">Precificado</option>
              <option value="withdrawn">Cancelado</option>
            </select>
          </div>

          {/* Sector filters */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Filtrar por setor
            </p>
            <div className="flex flex-wrap gap-2">
              {SECTORS.map((sector) => {
                const active = selectedSectors.includes(sector);
                const icon = sector === 'Todos' ? '🗂️' : SECTOR_ICONS[sector] || '📋';
                return (
                  <button
                    key={sector}
                    onClick={() => toggleSector(sector)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600'
                    }`}
                  >
                    <span className="text-base leading-none">{icon}</span>
                    {sector}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats bar */}
          {!loading && ipos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total', value: filteredIpos.length, icon: '📋' },
                { label: 'Em breve', value: filteredIpos.filter((i) => i.status === 'upcoming').length, icon: '🔜' },
                { label: 'Abertos', value: filteredIpos.filter((i) => i.status === 'open').length, icon: '✅' },
                {
                  label: 'Setores',
                  value: new Set(filteredIpos.map((i) => i.sector)).size,
                  icon: '🏷️',
                },
              ].map(({ label, value, icon }) => (
                <div
                  key={label}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 flex items-center gap-3"
                >
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{value}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* IPO List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-4 animate-pulse">📊</div>
              <p>Carregando IPOs...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
              <div className="text-3xl mb-2">⚠️</div>
              <p className="text-red-700 dark:text-red-400 font-medium">Erro ao carregar dados</p>
              <p className="text-red-500 dark:text-red-500 text-sm mt-1">{error}</p>
              <button
                onClick={() => fetchIPOs()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
              >
                Tentar novamente
              </button>
            </div>
          ) : filteredIpos.length === 0 ? (
            <div className="text-center py-20 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-3">🔍</div>
              <p className="font-medium">Nenhum IPO encontrado</p>
              <p className="text-sm mt-1">Tente ajustar os filtros ou a busca</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredIpos.map((ipo) => {
                const status = STATUS_CONFIG[ipo.status] || STATUS_CONFIG.upcoming;
                const countdown = daysUntil(ipo.date);
                const isExpanded = expandedId === ipo.id;

                return (
                  <div
                    key={ipo.id}
                    className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                  >
                    <button
                      className="w-full text-left p-4 sm:p-5"
                      onClick={() => setExpandedId(isExpanded ? null : ipo.id)}
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        {/* Sector icon */}
                        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-2xl">
                          {SECTOR_ICONS[ipo.sector] || '📋'}
                        </div>

                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-bold text-gray-900 dark:text-white">{ipo.company}</span>
                            {ipo.symbol && ipo.symbol !== '–' && (
                              <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                                {ipo.symbol}
                              </span>
                            )}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg}`}>
                              {status.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <span>🏷️</span> {ipo.sector}
                            </span>
                            <span className="flex items-center gap-1">
                              <span>📅</span> {formatDate(ipo.date)}
                              {countdown && (
                                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                  ({countdown})
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Right side */}
                        <div className="flex-shrink-0 text-right hidden sm:block">
                          <div className="font-semibold text-gray-900 dark:text-white text-sm">{ipo.priceRange}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ipo.volume}</div>
                        </div>

                        <div className="flex-shrink-0 text-gray-400 dark:text-gray-600">
                          {isExpanded ? '▲' : '▼'}
                        </div>
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-gray-800 px-4 sm:px-5 py-4 bg-gray-50 dark:bg-gray-900/50">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-3">
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Bolsa</div>
                            <div className="font-medium">{ipo.exchange}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Preço</div>
                            <div className="font-medium">{ipo.priceRange}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Volume</div>
                            <div className="font-medium">{ipo.volume}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Data</div>
                            <div className="font-medium">{formatDate(ipo.date)}</div>
                          </div>
                        </div>
                        {ipo.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">{ipo.description}</p>
                        )}
                        <div className="sm:hidden mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 flex gap-3 text-sm">
                          <span className="font-medium">{ipo.priceRange}</span>
                          <span className="text-gray-500">{ipo.volume}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer info about push notifications */}
          {notifStatus === 'idle' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">📱</span>
              <div className="text-sm">
                <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1">
                  Receba alertas no celular
                </p>
                <p className="text-blue-700 dark:text-blue-400">
                  Ative as notificações push para ser avisado quando novos IPOs forem anunciados.
                  Funciona diretamente no seu celular, sem precisar de app.
                </p>
                <button
                  onClick={enableNotifications}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                >
                  🔔 Ativar notificações agora
                </button>
              </div>
            </div>
          )}
        </main>

        <footer className="border-t border-gray-200 dark:border-gray-800 mt-10 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
          <p>
            Dados: <a href="https://br.investing.com/ipo-calendar/" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">br.investing.com</a>
            {' · '}
            <Link href="/" className="underline hover:text-blue-600">Voltar ao blog</Link>
          </p>
        </footer>
      </div>
    </>
  );
}
