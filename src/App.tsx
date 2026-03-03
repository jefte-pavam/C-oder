import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'motion/react';
import { 
  Heart, 
  X, 
  MessageCircle, 
  User as UserIcon, 
  PawPrint, 
  Camera, 
  Mic, 
  Video, 
  Settings,
  LogOut,
  Plus,
  Smile,
  Shield,
  BarChart3,
  Users,
  Dog as DogIcon,
  Clock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { io, Socket } from 'socket.io-client';
import { User, Dog, Match, Message } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const AvatarPicker = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => {
  const avatars = [
    '🐶', '🐱', '🦁', '🐯', '🐼', '🐨', '🐮', '🐷', '🐸', '🐵', '🦄', '🦊'
  ];
  return (
    <div className="flex flex-wrap gap-2 justify-center p-4">
      {avatars.map(a => (
        <button
          key={a}
          onClick={() => onChange(a)}
          className={cn(
            "text-3xl p-2 rounded-full transition-all",
            value === a ? "bg-primary scale-110 shadow-lg" : "bg-white hover:bg-slate-100"
          )}
        >
          {a}
        </button>
      ))}
    </div>
  );
};

interface DogCardProps {
  dog: Dog;
  onSwipe: (dir: 'left' | 'right') => void | Promise<void>;
}

const DogCard: React.FC<DogCardProps> = ({ dog, onSwipe }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  
  // Indicators opacity
  const likeOpacity = useTransform(x, [50, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-50, -150], [0, 1]);
  
  const [exitX, setExitX] = useState(0);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100) {
      setExitX(600);
      onSwipe('right');
    } else if (info.offset.x < -100) {
      setExitX(-600);
      onSwipe('left');
    }
  };

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={{ scale: 1.05 }}
      animate={{ x: 0 }}
      exit={{ 
        x: exitX, 
        opacity: 0,
        scale: 0.5,
        transition: { duration: 0.2 } 
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="tinder-card relative"
    >
      {/* Swipe Indicators */}
      <motion.div 
        style={{ opacity: likeOpacity }}
        className="absolute top-10 left-10 z-20 border-4 border-blue-500 text-blue-500 font-black text-4xl px-4 py-2 rounded-xl rotate-[-20deg] pointer-events-none"
      >
        QUERO!
      </motion.div>
      <motion.div 
        style={{ opacity: nopeOpacity }}
        className="absolute top-10 right-10 z-20 border-4 border-red-500 text-red-500 font-black text-4xl px-4 py-2 rounded-xl rotate-[20deg] pointer-events-none"
      >
        NÃO...
      </motion.div>

      <img 
        src={dog.photos[0] || `https://picsum.photos/seed/${dog.id}/400/600`} 
        className="w-full h-full object-cover pointer-events-none"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 gradient-overlay flex flex-col justify-end p-6 text-white pointer-events-none">
        <h2 className="text-3xl font-bold">{dog.name}, {dog.age}</h2>
        <p className="text-lg opacity-90">{dog.breed}</p>
        <div className="flex gap-2 mt-2">
          <span className="bg-white/20 px-2 py-1 rounded-full text-xs backdrop-blur-sm">Energia: {dog.behavior.energy}/5</span>
          <span className="bg-white/20 px-2 py-1 rounded-full text-xs backdrop-blur-sm">Social: {dog.behavior.sociability}/5</span>
        </div>
        <p className="mt-3 text-sm line-clamp-2 italic opacity-80">"{dog.bio}"</p>
      </div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'landing' | 'auth' | 'discover' | 'matches' | 'chat' | 'profile' | 'admin'>('landing');
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [adminStats, setAdminStats] = useState<any>(null);

  const fetchAdminStats = async () => {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    setAdminStats(data);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = (e.target as any).username.value;
    const password = (e.target as any).password.value;
    const res = await fetch('/api/auth/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      fetchAdminStats();
      setView('admin');
    } else {
      alert('Credenciais de administrador inválidas.');
    }
  };
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [regData, setRegData] = useState({ name: '', email: '', role: 'ADOPTER' as const, emoji: '🐶' });

  useEffect(() => {
    if (user) {
      fetchDogs();
      fetchMatches();
      const newSocket = io();
      setSocket(newSocket);
      return () => { newSocket.close(); };
    }
  }, [user]);

  useEffect(() => {
    if (socket && activeMatch) {
      socket.emit('join_room', activeMatch.id);
      socket.on('receive_message', (msg: Message) => {
        setMessages(prev => [...prev, msg]);
      });
      return () => { socket.off('receive_message'); };
    }
  }, [socket, activeMatch]);

  const fetchDogs = async () => {
    const res = await fetch('/api/dogs');
    const data = await res.json();
    setDogs(data);
  };

  const fetchMatches = async () => {
    if (!user) return;
    const res = await fetch(`/api/matches/${user.id}`);
    const data = await res.json();
    setMatches(data);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = (e.target as any).email.value;
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      setView('discover');
    } else {
      alert('Usuário não encontrado. Tente se registrar!');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = Math.random().toString(36).substr(2, 9);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...regData, id })
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      setView('discover');
    }
  };

  const [showMatch, setShowMatch] = useState<Dog | null>(null);

  const onSwipe = async (dogId: string, direction: 'left' | 'right') => {
    if (!user) return;
    const res = await fetch('/api/swipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adopter_id: user.id, dog_id: dogId, direction })
    });
    const data = await res.json();
    if (data.match) {
      const matchedDog = dogs.find(d => d.id === dogId);
      if (matchedDog) setShowMatch(matchedDog);
      fetchMatches();
    }
    setDogs(prev => prev.filter(d => d.id !== dogId));
  };


  const sendMessage = (content: string, type: Message['type'] = 'text') => {
    if (!socket || !activeMatch || !user) return;
    const msg: Message = {
      match_id: activeMatch.id,
      sender_id: user.id,
      content,
      type
    };
    socket.emit('send_message', msg);
  };

  // --- Views ---

  if (view === 'landing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-orange-400 text-white p-6">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="bg-white p-4 rounded-3xl inline-block mb-6 shadow-2xl">
            <PawPrint size={64} className="text-primary" />
          </div>
          <h1 className="text-6xl font-bold mb-2 font-serif italic">Cãoder</h1>
          <p className="text-xl opacity-90 mb-12">Encontre o seu melhor amigo, um swipe por vez.</p>
          
          <div className="space-y-4 w-full max-w-xs mx-auto">
            <button 
              onClick={() => { setAuthMode('register'); setView('auth'); }}
              className="w-full bg-white text-primary font-bold py-4 rounded-full shadow-lg hover:scale-105 transition-transform"
            >
              Criar Conta
            </button>
            <button 
              onClick={() => { setAuthMode('login'); setView('auth'); }}
              className="w-full bg-transparent border-2 border-white text-white font-bold py-4 rounded-full hover:bg-white/10 transition-colors"
            >
              Entrar
            </button>
            <button 
              onClick={() => { setAuthMode('login'); setView('auth'); setIsAdminLogin(true); }}
              className="text-xs opacity-50 hover:opacity-100 transition-opacity mt-8"
            >
              Acesso Administrativo
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-warm flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
          <button onClick={() => { setView('landing'); setIsAdminLogin(false); }} className="text-slate-400 mb-4 hover:text-primary">← Voltar</button>
          <h2 className="text-3xl font-bold mb-6 text-center">
            {isAdminLogin ? 'Painel Admin' : (authMode === 'login' ? 'Bem-vindo de volta!' : 'Junte-se à matilha')}
          </h2>
          
          <form onSubmit={isAdminLogin ? handleAdminLogin : (authMode === 'login' ? handleLogin : handleRegister)} className="space-y-4">
            {isAdminLogin ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Usuário</label>
                  <input 
                    name="username"
                    required
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Senha</label>
                  <input 
                    name="password"
                    type="password"
                    required
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </>
            ) : (
              <>
                {authMode === 'register' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Nome</label>
                      <input 
                        required
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none"
                        value={regData.name}
                        onChange={e => setRegData({...regData, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Eu sou...</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          type="button"
                          onClick={() => setRegData({...regData, role: 'ADOPTER'})}
                          className={cn("p-3 rounded-xl border transition-all", regData.role === 'ADOPTER' ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200")}
                        >
                          Quero Adotar
                        </button>
                        <button 
                          type="button"
                          onClick={() => setRegData({...regData, role: 'DONOR'})}
                          className={cn("p-3 rounded-xl border transition-all", regData.role === 'DONOR' ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200")}
                        >
                          Tenho Cães
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Escolha seu Avatar/Emoji</label>
                      <AvatarPicker value={regData.emoji} onChange={v => setRegData({...regData, emoji: v})} />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">E-mail</label>
                  <input 
                    name="email"
                    type="email"
                    required
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none"
                    value={regData.email}
                    onChange={e => setRegData({...regData, email: e.target.value})}
                  />
                </div>
              </>
            )}
            <button className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg hover:opacity-90 transition-opacity mt-4">
              {isAdminLogin ? 'Entrar como Admin' : (authMode === 'login' ? 'Entrar' : 'Cadastrar')}
            </button>
          </form>
          
          {!isAdminLogin && (
            <p className="text-center mt-6 text-slate-500">
              {authMode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}
              <button 
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="ml-1 text-primary font-bold hover:underline"
              >
                {authMode === 'login' ? 'Cadastre-se' : 'Faça login'}
              </button>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto h-screen flex flex-col bg-white shadow-2xl relative overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b">
        <button onClick={() => setView('profile')} className="text-slate-400 hover:text-primary">
          {user?.emoji ? <span className="text-2xl">{user.emoji}</span> : <UserIcon size={28} />}
        </button>
        <div className="flex items-center gap-1 text-primary font-bold text-xl font-serif italic">
          <PawPrint size={24} />
          Cãoder
        </div>
        <button onClick={() => setView('matches')} className="text-slate-400 hover:text-primary relative">
          <MessageCircle size={28} />
          {matches.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
              {matches.length}
            </span>
          )}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative p-4">
        <AnimatePresence>
          {showMatch && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 z-50 bg-primary/95 flex flex-col items-center justify-center text-white p-6 text-center"
            >
              <h2 className="text-5xl font-serif italic mb-2">It's a Match!</h2>
              <p className="mb-8">Você e {showMatch.name} foram feitos um para o outro!</p>
              <div className="flex gap-4 mb-8">
                <div className="w-24 h-24 rounded-full border-4 border-white overflow-hidden shadow-xl">
                  <span className="text-5xl flex items-center justify-center h-full bg-white/20">{user?.emoji}</span>
                </div>
                <div className="w-24 h-24 rounded-full border-4 border-white overflow-hidden shadow-xl">
                  <img src={showMatch.photos[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              </div>
              <div className="space-y-4 w-full">
                <button 
                  onClick={() => { setShowMatch(null); setView('matches'); }}
                  className="w-full bg-white text-primary font-bold py-4 rounded-full shadow-lg"
                >
                  Enviar Mensagem
                </button>
                <button 
                  onClick={() => setShowMatch(null)}
                  className="w-full bg-transparent border-2 border-white text-white font-bold py-4 rounded-full"
                >
                  Continuar Swiping
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {view === 'admin' && adminStats && (
          <div className="h-full overflow-y-auto space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="text-primary" /> Painel Admin
              </h3>
              <button onClick={fetchAdminStats} className="text-primary text-sm font-bold">Atualizar</button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                  <Users size={16} /> Usuários
                </div>
                <div className="text-2xl font-bold">{adminStats.totalUsers}</div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                  <DogIcon size={16} /> Cachorros
                </div>
                <div className="text-2xl font-bold">{adminStats.totalDogs}</div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                  <Heart size={16} /> Matches
                </div>
                <div className="text-2xl font-bold">{adminStats.totalMatches}</div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                  <Clock size={16} /> Uso Médio
                </div>
                <div className="text-2xl font-bold">{adminStats.usageStats.avgSessionTime}</div>
              </div>
            </div>

            {/* Breed Ranking Chart */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-primary" /> Raças Mais Desejadas
              </h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={adminStats.breedRanking}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="breed" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#FF6B6B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Role Distribution */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <h4 className="font-bold mb-4">Distribuição de Usuários</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={adminStats.roleDistribution}
                      dataKey="count"
                      nameKey="role"
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      label
                    >
                      <Cell fill="#FF6B6B" />
                      <Cell fill="#4ECDC4" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 text-xs">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-primary rounded-full"></div> Doadores</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-secondary rounded-full"></div> Adotantes</div>
              </div>
            </div>

            <button 
              onClick={() => { setUser(null); setView('landing'); }}
              className="w-full p-4 bg-slate-100 text-slate-600 rounded-2xl font-bold"
            >
              Sair do Painel
            </button>
          </div>
        )}

        {view === 'discover' && (

          <div className="h-full flex flex-col">
            <div className="flex-1 relative">
              <AnimatePresence>
                {dogs.length > 0 ? (
                  dogs.slice(0, 1).map(dog => (
                    <DogCard key={dog.id} dog={dog} onSwipe={(dir) => onSwipe(dog.id, dir)} />
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-8">
                    <div className="bg-slate-100 p-6 rounded-full mb-4">
                      <PawPrint size={48} />
                    </div>
                    <p className="text-lg font-medium">Não há mais cães por perto!</p>
                    <p className="text-sm">Tente aumentar o seu raio de busca ou volte mais tarde.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Swipe Buttons */}
            {dogs.length > 0 && (
              <div className="flex justify-center gap-6 py-6">
                <button 
                  onClick={() => onSwipe(dogs[0].id, 'left')}
                  className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center text-red-500 border-2 border-red-50 border-slate-100 hover:scale-110 transition-transform"
                >
                  <X size={32} />
                </button>
                <button 
                  onClick={() => onSwipe(dogs[0].id, 'right')}
                  className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center text-blue-500 border-2 border-blue-50 border-slate-100 hover:scale-110 transition-transform"
                >
                  <PawPrint size={32} fill="currentColor" />
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'matches' && (
          <div className="h-full overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Seus Matches</h3>
            <div className="grid grid-cols-2 gap-4">
              {matches.map(match => (
                <button 
                  key={match.id}
                  onClick={() => { setActiveMatch(match); setView('chat'); }}
                  className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-md group"
                >
                  <img 
                    src={match.dog_photos?.[0] || `https://picsum.photos/seed/${match.dog_id}/300/400`} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-3 text-white">
                    <p className="font-bold">{match.dog_name}</p>
                    <p className="text-xs opacity-80">Dono: {match.owner_name}</p>
                  </div>
                </button>
              ))}
              {matches.length === 0 && (
                <div className="col-span-2 text-center py-12 text-slate-400">
                  Ainda não deu match? Continue dando swipe!
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'chat' && activeMatch && (
          <div className="h-full flex flex-col -m-4">
            <div className="p-4 border-b flex items-center gap-3">
              <button onClick={() => setView('matches')} className="text-slate-400">←</button>
              <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                <img src={activeMatch.dog_photos?.[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div>
                <p className="font-bold leading-tight">{activeMatch.dog_name}</p>
                <p className="text-xs text-slate-500">Conversando com {activeMatch.owner_name}</p>
              </div>
              <div className="ml-auto flex gap-3 text-primary">
                <button className="hover:scale-110 transition-transform"><Mic size={20} /></button>
                <button className="hover:scale-110 transition-transform"><Video size={20} /></button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.sender_id === user?.id ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] p-3 rounded-2xl shadow-sm",
                    msg.sender_id === user?.id ? "bg-primary text-white rounded-tr-none" : "bg-white text-slate-800 rounded-tl-none"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="text-center py-8 text-slate-400 italic text-sm">
                  Comece uma conversa sobre o {activeMatch.dog_name}!
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t flex gap-2">
              <input 
                placeholder="Diga oi..."
                className="flex-1 bg-slate-100 p-3 rounded-full outline-none focus:ring-2 focus:ring-primary/20"
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    sendMessage(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
              <button className="bg-primary text-white p-3 rounded-full shadow-lg">
                <Smile size={24} />
              </button>
            </div>
          </div>
        )}

        {view === 'profile' && user && (
          <div className="h-full overflow-y-auto space-y-6">
            <div className="flex flex-col items-center py-6">
              <div className="w-32 h-32 rounded-full bg-white shadow-xl flex items-center justify-center text-6xl border-4 border-primary/20 mb-4">
                {user.emoji}
              </div>
              <h2 className="text-2xl font-bold">{user.name}</h2>
              <p className="text-slate-500">{user.role === 'ADOPTER' ? 'Adotante' : 'Doador'}</p>
            </div>

            <div className="space-y-2">
              <button className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="bg-blue-50 p-2 rounded-lg text-blue-500"><Settings size={20} /></div>
                <span className="font-medium">Configurações</span>
              </button>
              <button className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="bg-purple-50 p-2 rounded-lg text-purple-500"><Camera size={20} /></div>
                <span className="font-medium">Editar Fotos</span>
              </button>
              {user.role === 'DONOR' && (
                <button className="w-full flex items-center gap-4 p-4 bg-primary text-white rounded-2xl shadow-lg hover:opacity-90 transition-opacity">
                  <Plus size={20} />
                  <span className="font-medium">Cadastrar Novo Cão</span>
                </button>
              )}
              <button 
                onClick={() => { setUser(null); setView('landing'); }}
                className="w-full flex items-center gap-4 p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors mt-8"
              >
                <LogOut size={20} />
                <span className="font-medium">Sair</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav (Only for main views) */}
      {['discover', 'matches', 'profile'].includes(view) && (
        <nav className="flex justify-around p-4 border-t bg-white">
          <button 
            onClick={() => setView('discover')}
            className={cn("p-2 rounded-full transition-colors", view === 'discover' ? "text-primary" : "text-slate-300")}
          >
            <PawPrint size={28} />
          </button>
          <button 
            onClick={() => setView('matches')}
            className={cn("p-2 rounded-full transition-colors", view === 'matches' ? "text-primary" : "text-slate-300")}
          >
            <MessageCircle size={28} />
          </button>
          <button 
            onClick={() => setView('profile')}
            className={cn("p-2 rounded-full transition-colors", view === 'profile' ? "text-primary" : "text-slate-300")}
          >
            <UserIcon size={28} />
          </button>
        </nav>
      )}
    </div>
  );
}
