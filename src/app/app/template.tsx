// Coquille (SYSTEME) : transition de page douce entre écrans de l'app. Le gabarit est remonté à chaque navigation,
// ce qui rejoue un fondu de 260 ms (+ 6 px de montée hors mouvement réduit). Contenu rendu serveur, jamais masqué sans CSS.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="rp-page-in">{children}</div>;
}
