// Configuração da sincronização entre navegadores (opcional).
//
// Deixe como está (null) para o painel continuar funcionando como hoje: cada navegador com seu
// próprio rascunho, publicado manualmente pelo botão "Baixar data.js para publicar".
//
// Para que as alterações de uma coordenadora apareçam automaticamente para as outras, crie um
// projeto gratuito em https://console.firebase.google.com (leva uns 5 minutos, veja o passo a
// passo no README, seção "Sincronizar entre navegadores") e cole aqui o objeto de configuração
// que o Firebase te dá — algo como:
//
// window.FIREBASE_CONFIG = {
//   apiKey: "AIzaSy...",
//   authDomain: "polo1740.firebaseapp.com",
//   projectId: "polo1740",
//   storageBucket: "polo1740.appspot.com",
//   messagingSenderId: "...",
//   appId: "..."
// };
//
// Essas chaves não são secretas (o Firebase foi desenhado para isso) — quem protege os dados são
// as regras de segurança do banco, explicadas no mesmo passo a passo.
//
// IMPORTANTE: este é um painel separado do Polo 1740 — crie um projeto Firebase NOVO e
// específico para a Washington Ilha (não reaproveite a configuração do Polo 1740), para que
// os dados dos dois painéis não se misturem no mesmo banco.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDDX6iqwC751f3ug9kdLTgFA0hEITMXAAk",
  authDomain: "washington-2c0ca.firebaseapp.com",
  projectId: "washington-2c0ca",
  storageBucket: "washington-2c0ca.firebasestorage.app",
  messagingSenderId: "308701324586",
  appId: "1:308701324586:web:4e9f33cd00ff94e99c6a53"
};
