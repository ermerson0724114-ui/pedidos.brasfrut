import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, Leaf, ArrowLeft, UserPlus, KeyRound, Camera, Search, User } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import SelfieCapture from "@/components/SelfieCapture";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { setAuth } = useAuthStore();
  const { toast } = useToast();
  const [tab, setTab] = useState("employee");
  const [registration, setRegistration] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<"registration" | "password" | "create-password">("registration");
  const [empId, setEmpId] = useState<number | null>(null);
  const [empName, setEmpName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [recoveredPassword, setRecoveredPassword] = useState<string | null>(null);

  const [searchNameMode, setSearchNameMode] = useState(false);
  const [searchNameQuery, setSearchNameQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: number; name: string; registration_number: string; needsPassword: boolean; score: number }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  const companyName = settings?.companyName || "Brasfrut";
  const logoUrl = settings?.logoUrl || null;

  const handleCheckRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/check", { username: registration });
      const data = await res.json();
      setEmpId(data.employeeId);
      setEmpName(data.name);
      if (data.needsPassword) {
        setStep("create-password");
      } else {
        setStep("password");
      }
    } catch (err: any) {
      const msg = err.message?.includes(":") ? err.message.split(": ").slice(1).join(": ") : "Matrícula não encontrada";
      toast({ title: msg, variant: "destructive" });
    }
    setLoading(false);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login", {
        type: "employee",
        username: registration,
        password,
      });
      const data = await res.json();
      setAuth(data.user, data.token);
      navigate("/dashboard");
      toast({ title: `Bem-vindo, ${data.user.name.split(" ")[0]}!`, variant: "success" });
    } catch (err: any) {
      const msg = err.message?.includes(":") ? err.message.split(": ").slice(1).join(": ") : "Senha incorreta";
      toast({ title: msg, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login", {
        type: "admin",
        username: registration,
        password,
      });
      const data = await res.json();
      setAuth(data.user, data.token);
      navigate("/admin");
      toast({ title: `Bem-vindo, ${data.user.name.split(" ")[0]}!`, variant: "success" });
    } catch (err: any) {
      const msg = err.message?.includes(":") ? err.message.split(": ").slice(1).join(": ") : "Credenciais inválidas";
      toast({ title: msg, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfiePhoto) return toast({ title: "Tire uma foto para verificação", variant: "destructive" });
    if (newPassword.length < 6) return toast({ title: "Mínimo 6 caracteres", variant: "destructive" });
    if (newPassword !== confirmPassword) return toast({ title: "Senhas não coincidem", variant: "destructive" });
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/create-password", { employeeId: empId, password: newPassword, selfiePhoto });
      const data = await res.json();
      setAuth(data.user, data.token);
      navigate("/dashboard");
      toast({ title: "Senha criada com sucesso!", variant: "success" });
    } catch {
      toast({ title: "Erro ao criar senha", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest("POST", "/api/auth/recover", { email: forgotEmail });
      const data = await res.json();
      setRecoveredPassword(data.password);
    } catch {
      toast({ title: "Email não autorizado para recuperação", variant: "destructive" });
    }
  };

  const handleSearchByName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchNameQuery.trim().length < 2) {
      toast({ title: "Digite pelo menos 2 caracteres", variant: "destructive" });
      return;
    }
    setSearchLoading(true);
    setSearchDone(false);
    try {
      const res = await apiRequest("POST", "/api/auth/search-by-name", { name: searchNameQuery });
      const data = await res.json();
      setSearchResults(data.results || []);
      setSearchDone(true);
    } catch {
      toast({ title: "Erro ao buscar", variant: "destructive" });
    }
    setSearchLoading(false);
  };

  const handleSelectFoundEmployee = (emp: { id: number; name: string; registration_number: string; needsPassword: boolean }) => {
    setSearchNameMode(false);
    setRegistration(emp.registration_number);
    setEmpId(emp.id);
    setEmpName(emp.name);
    if (emp.needsPassword) {
      setStep("create-password");
    } else {
      setStep("password");
    }
  };

  const resetToStart = () => {
    setStep("registration");
    setRegistration("");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setEmpId(null);
    setEmpName("");
    setSelfiePhoto(null);
    setShowSelfieCapture(false);
    setSearchNameMode(false);
    setSearchNameQuery("");
    setSearchResults([]);
    setSearchDone(false);
  };

  const renderContent = () => {
    if (forgotMode) {
      if (tab === "admin") {
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => { setForgotMode(false); setRecoveredPassword(null); setForgotEmail(""); }}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center" data-testid="button-back-login">
                <ArrowLeft size={16} />
              </button>
              <h2 className="font-bold text-gray-800">Recuperar senha</h2>
            </div>
            {recoveredPassword ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                <p className="text-sm text-gray-600 mb-2">Sua senha atual é:</p>
                <p className="text-2xl font-bold text-green-900 tracking-widest" data-testid="text-recovered-password">{recoveredPassword}</p>
                <p className="text-xs text-gray-400 mt-3">Guarde em local seguro e altere após o login.</p>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-gray-500">Digite o email de recuperação cadastrado para visualizar a senha.</p>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email de recuperação</label>
                  <input type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Digite o email cadastrado" data-testid="input-recovery-email" />
                </div>
                <button type="submit" className="w-full bg-green-900 text-white font-bold py-3.5 rounded-2xl transition-all active:scale-[0.98]"
                  data-testid="button-recover-password">Recuperar senha</button>
              </form>
            )}
          </div>
        );
      }
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => { setForgotMode(false); }}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center" data-testid="button-back-login">
              <ArrowLeft size={16} />
            </button>
            <h2 className="font-bold text-gray-800">Esqueci minha senha</h2>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <KeyRound size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-800 mb-1">Entre em contato com o administrador</p>
                <p className="text-xs text-amber-700 leading-relaxed">Para recuperar sua senha, procure o administrador do sistema. Ele poderá redefinir seu acesso.</p>
              </div>
            </div>
          </div>
          <button onClick={() => setForgotMode(false)}
            className="w-full bg-gray-100 text-gray-700 font-semibold py-3.5 rounded-2xl transition-all active:scale-[0.98]"
            data-testid="button-back-from-forgot">Voltar ao login</button>
        </div>
      );
    }

    if (searchNameMode) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => { setSearchNameMode(false); setSearchNameQuery(""); setSearchResults([]); setSearchDone(false); }}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center" data-testid="button-back-from-search">
              <ArrowLeft size={16} />
            </button>
            <h2 className="font-bold text-gray-800">Buscar por nome</h2>
          </div>
          <p className="text-sm text-gray-500">Digite seu nome completo para buscarmos seu cadastro.</p>
          <form onSubmit={handleSearchByName} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nome completo</label>
              <input type="text" required value={searchNameQuery} onChange={e => setSearchNameQuery(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Ex: João da Silva" data-testid="input-search-name" autoFocus />
            </div>
            <button type="submit" disabled={searchLoading}
              className="w-full bg-green-900 text-white font-bold py-3.5 rounded-2xl disabled:opacity-60 transition-all active:scale-[0.98]"
              data-testid="button-search-name">{searchLoading ? "Buscando..." : "Buscar"}</button>
          </form>

          {searchDone && (
            <div className="mt-2">
              {searchResults.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <Search size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">Nenhum resultado encontrado</p>
                  <p className="text-xs mt-1">Verifique a grafia do seu nome e tente novamente.</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{searchResults.length} resultado(s) encontrado(s)</p>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {searchResults.map(emp => (
                      <button key={emp.id} onClick={() => handleSelectFoundEmployee(emp)}
                        className="w-full text-left bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 rounded-2xl p-3 transition-all"
                        data-testid={`button-select-employee-${emp.id}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <User size={16} className="text-green-700" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{emp.name}</p>
                            <p className="text-xs text-gray-500">Matrícula: {emp.registration_number}</p>
                          </div>
                          {emp.needsPassword && (
                            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex-shrink-0">Novo</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (tab === "admin") {
      return (
        <>
          <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
            <button onClick={() => { setTab("employee"); resetToStart(); }}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all text-gray-500"
              data-testid="tab-employee">Funcionário</button>
            <button className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all bg-green-900 text-white shadow-sm"
              data-testid="tab-admin">Administrador</button>
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Usuário</label>
              <input type="text" required value={registration} onChange={e => setRegistration(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                placeholder="Administrador" data-testid="input-registration" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Senha</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 pr-12 transition-all"
                  placeholder="Digite sua senha" data-testid="input-password" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" data-testid="button-toggle-password">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-green-900 text-white font-bold py-3.5 rounded-2xl disabled:opacity-60 mt-2 transition-all active:scale-[0.98]"
              data-testid="button-login">{loading ? "Entrando..." : "Entrar"}</button>
          </form>
          <button onClick={() => setForgotMode(true)} className="w-full text-center text-sm text-green-700 font-medium mt-4"
            data-testid="button-forgot-password">Esqueci minha senha</button>
        </>
      );
    }

    if (step === "create-password") {
      if (showSelfieCapture) {
        return (
          <SelfieCapture
            onCapture={(base64) => {
              setSelfiePhoto(base64);
              setShowSelfieCapture(false);
            }}
            onCancel={() => setShowSelfieCapture(false)}
          />
        );
      }

      return (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={resetToStart} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center" data-testid="button-back-registration">
              <ArrowLeft size={16} />
            </button>
            <h2 className="font-bold text-gray-800">Criar senha</h2>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <UserPlus size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-800">Bem-vindo(a), {empName.split(" ")[0]}!</p>
                <p className="text-xs text-blue-600 mt-0.5">Este é seu primeiro acesso. Verifique sua identidade e crie uma senha.</p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Verificação por foto</label>
            {selfiePhoto ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-green-300 bg-black">
                <img src={selfiePhoto} alt="Selfie de verificação" className="w-full aspect-[3/4] object-cover" data-testid="img-selfie-preview" />
                <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                  <Camera size={14} />
                </div>
                <button
                  type="button"
                  onClick={() => setShowSelfieCapture(true)}
                  className="absolute bottom-2 right-2 bg-white/90 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-xl"
                  data-testid="button-retake-selfie-preview"
                >
                  Tirar outra
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSelfieCapture(true)}
                className="w-full py-8 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors"
                data-testid="button-open-selfie-capture"
              >
                <Camera size={32} />
                <span className="text-sm font-medium">Tirar foto de verificação</span>
                <span className="text-xs">Obrigatório para criar sua conta</span>
              </button>
            )}
          </div>

          <form onSubmit={handleCreatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nova senha</label>
              <input type="password" required minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Mínimo 6 caracteres" data-testid="input-new-password" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Confirmar senha</label>
              <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Repita a senha" data-testid="input-confirm-password" />
            </div>
            <button type="submit" disabled={loading || !selfiePhoto}
              className="w-full bg-green-900 text-white font-bold py-3.5 rounded-2xl disabled:opacity-60 transition-all active:scale-[0.98]"
              data-testid="button-create-password">{loading ? "Salvando..." : "Criar senha e entrar"}</button>
          </form>
        </div>
      );
    }

    if (step === "password") {
      return (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={resetToStart} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center" data-testid="button-back-registration">
              <ArrowLeft size={16} />
            </button>
            <h2 className="font-bold text-gray-800">Entrar</h2>
          </div>
          <div className="bg-gray-50 rounded-2xl p-3 mb-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <KeyRound size={16} className="text-green-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{empName}</p>
              <p className="text-xs text-gray-500">Matrícula: {registration}</p>
            </div>
          </div>
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Senha</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 pr-12 transition-all"
                  placeholder="Digite sua senha" data-testid="input-password" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" data-testid="button-toggle-password">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-green-900 text-white font-bold py-3.5 rounded-2xl disabled:opacity-60 transition-all active:scale-[0.98]"
              data-testid="button-login">{loading ? "Entrando..." : "Entrar"}</button>
          </form>
          <button onClick={() => setForgotMode(true)} className="w-full text-center text-sm text-green-700 font-medium mt-4"
            data-testid="button-forgot-password">Esqueci minha senha</button>
        </div>
      );
    }

    return (
      <>
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
          <button className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all bg-green-900 text-white shadow-sm"
            data-testid="tab-employee">Funcionário</button>
          <button onClick={() => { setTab("admin"); setRegistration(""); setPassword(""); }}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all text-gray-500"
            data-testid="tab-admin">Administrador</button>
        </div>
        <form onSubmit={handleCheckRegistration} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Matrícula</label>
            <input type="text" required value={registration} onChange={e => setRegistration(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
              placeholder="Digite sua matrícula" data-testid="input-registration" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-green-900 text-white font-bold py-3.5 rounded-2xl disabled:opacity-60 mt-2 transition-all active:scale-[0.98]"
            data-testid="button-next">{loading ? "Verificando..." : "Continuar"}</button>
        </form>
        <button onClick={() => setSearchNameMode(true)} className="w-full text-center text-sm text-green-700 font-medium mt-4"
          data-testid="button-search-by-name">Não sabe seu número de inscrição?</button>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-green-800 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-green-800/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-green-700/20 blur-3xl" />
      </div>
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          {logoUrl ? (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4 overflow-hidden bg-white/10 backdrop-blur-sm">
              <img src={logoUrl} alt={companyName} className="w-full h-full object-contain p-1" data-testid="img-login-logo" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-3xl mb-4">
              <Leaf size={40} className="text-green-300" />
            </div>
          )}
          <h1 className="text-3xl font-extrabold text-white tracking-tight" data-testid="text-company-name">{companyName}</h1>
          <p className="text-green-300 text-sm mt-1 font-medium">Sistema de Pedidos</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-6">
          {renderContent()}
        </div>
        <p className="text-center text-green-400/60 text-xs mt-6">{companyName} Frutos do Brasil</p>
      </div>
    </div>
  );
}
