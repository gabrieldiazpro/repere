/**
 * Typographie française à l'affichage : espaces insécables avant « ; : ! ? » et à l'intérieur
 * des guillemets, pour éviter un signe orphelin en début de ligne (« \n: adresse », « shampoing «\n solide »).
 * Purement visuel : ne pas utiliser sur une valeur copiée ou comparée.
 */
export function fr(text: string): string;
export function fr(text: string | undefined | null): string | undefined | null;
export function fr(text: string | undefined | null) {
  if (!text) return text;
  return text
    .replace(/« /g, '« ')
    .replace(/ »/g, ' »')
    .replace(/ ([:;!?])(?=\s|$|»| )/g, ' $1');
}
