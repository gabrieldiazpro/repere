<?php
/**
 * Plugin Name:       Repéré — référencement IA
 * Plugin URI:        https://repere-ia.fr/
 * Description:       Insère côté serveur le balisage schema.org (JSON-LD) de votre fiche de vérité Repéré, lisible par Google et par les robots des IA (qui n'exécutent pas le JavaScript). Expose à l'API REST les champs SEO de Yoast SEO ou Rank Math (titre, description, canonique) pour que l'agent Repéré les modifie après votre validation. Option : relaie les visites des robots IA vers Repéré (sans adresse IP).
 * Version:           1.1.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Repéré
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       repere-ia
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Repere_IA {
	const VERSION        = '1.1.0';
	const OPTION         = 'repere_ia_settings';
	const LAST_GOOD      = 'repere_ia_jsonld_last';
	const CACHE_TTL      = 12 * HOUR_IN_SECONDS;
	const RETRY_TTL      = 15 * MINUTE_IN_SECONDS;
	const DEFAULT_API    = 'https://repere-ia.fr';

	/** Robots des IA relayés (les autres visites ne sont jamais transmises). */
	const AI_BOTS = array(
		'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
		'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'GoogleOther', 'Applebot-Extended', 'Bytespider',
		'CCBot', 'Amazonbot', 'meta-externalagent', 'DuckAssistBot', 'MistralAI-User', 'cohere-ai', 'YouBot',
	);

	public static function init() {
		add_action( 'wp_head', array( __CLASS__, 'print_jsonld' ), 1 );
		add_action( 'init', array( __CLASS__, 'register_seo_meta' ), 99 );
		add_action( 'template_redirect', array( __CLASS__, 'relay_bot' ), 0 );
		add_action( 'admin_menu', array( __CLASS__, 'admin_menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
		add_action( 'admin_post_repere_ia_refresh', array( __CLASS__, 'handle_refresh' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), array( __CLASS__, 'action_links' ) );
	}

	/* ------------------------------------------------------------------ */
	/* Champs SEO exposés à l'API REST (agent de publication Repéré, V5)   */
	/* ------------------------------------------------------------------ */

	/**
	 * Yoast SEO garde le titre et la description dans des métas protégées (préfixe « _ ») que l'API REST n'expose pas ;
	 * Rank Math non plus. On les déclare avec `show_in_rest` : lecture (pour garder l'« avant » exact et permettre le
	 * retour arrière) et écriture réservées à qui peut modifier la publication (`edit_post`), via un mot de passe
	 * d'application. Rien n'est écrit par l'extension elle-même.
	 */
	public static function seo_meta_keys() {
		$keys = array();
		if ( defined( 'WPSEO_VERSION' ) ) {
			$keys['_yoast_wpseo_title']     = 'text';
			$keys['_yoast_wpseo_metadesc']  = 'text';
			$keys['_yoast_wpseo_canonical'] = 'url';
		}
		if ( class_exists( 'RankMath' ) || defined( 'RANK_MATH_VERSION' ) ) {
			$keys['rank_math_title']         = 'text';
			$keys['rank_math_description']   = 'text';
			$keys['rank_math_canonical_url'] = 'url';
		}
		return apply_filters( 'repere_ia_seo_meta_keys', $keys );
	}

	public static function register_seo_meta() {
		$keys = self::seo_meta_keys();
		if ( empty( $keys ) ) {
			return;
		}
		$types = get_post_types( array( 'show_in_rest' => true ), 'names' );
		foreach ( $types as $type ) {
			if ( ! post_type_supports( $type, 'custom-fields' ) ) {
				add_post_type_support( $type, 'custom-fields' );
			}
			foreach ( $keys as $key => $kind ) {
				register_post_meta(
					$type,
					$key,
					array(
						'type'              => 'string',
						'single'            => true,
						'default'           => '',
						'show_in_rest'      => true,
						'sanitize_callback' => ( 'url' === $kind ) ? 'esc_url_raw' : 'sanitize_text_field',
						'auth_callback'     => static function ( $allowed, $meta_key, $post_id ) {
							return current_user_can( 'edit_post', $post_id );
						},
					)
				);
			}
		}
	}

	/* ------------------------------------------------------------------ */
	/* Réglages                                                            */
	/* ------------------------------------------------------------------ */

	public static function settings() {
		$defaults = array(
			'api_base'    => self::DEFAULT_API,
			'business_id' => '',
			'scope'       => 'front', // 'front' = page d'accueil seulement, 'all' = toutes les pages
			'include_faq' => 0,       // FAQPage : uniquement si la FAQ est visible sur la page
			'bot_relay'   => 0,
			'bot_key'     => '',
		);
		$saved = get_option( self::OPTION, array() );
		return wp_parse_args( is_array( $saved ) ? $saved : array(), $defaults );
	}

	public static function sanitize( $in ) {
		$out                = self::settings();
		$in                 = is_array( $in ) ? $in : array();
		$base               = isset( $in['api_base'] ) ? esc_url_raw( trim( $in['api_base'] ) ) : self::DEFAULT_API;
		$out['api_base']    = ( $base && 0 === strpos( $base, 'https://' ) ) ? untrailingslashit( $base ) : self::DEFAULT_API;
		$id                 = isset( $in['business_id'] ) ? trim( (string) $in['business_id'] ) : '';
		$out['business_id'] = preg_match( '/^[A-Za-z0-9_-]{1,100}$/', $id ) ? $id : '';
		$out['scope']       = ( isset( $in['scope'] ) && 'all' === $in['scope'] ) ? 'all' : 'front';
		$out['include_faq'] = empty( $in['include_faq'] ) ? 0 : 1;
		$out['bot_relay']   = empty( $in['bot_relay'] ) ? 0 : 1;
		$key                = isset( $in['bot_key'] ) ? trim( (string) $in['bot_key'] ) : '';
		$out['bot_key']     = preg_match( '/^[0-9a-f]{64}$/i', $key ) ? $key : '';
		self::flush_cache();
		return $out;
	}

	/* ------------------------------------------------------------------ */
	/* JSON-LD (rendu serveur, cache transient)                            */
	/* ------------------------------------------------------------------ */

	private static function cache_key( $s ) {
		return 'repere_ia_ld_' . md5( $s['api_base'] . '|' . $s['business_id'] . '|' . $s['include_faq'] );
	}

	public static function flush_cache() {
		$s = self::settings();
		delete_transient( self::cache_key( $s ) );
	}

	/** Renvoie le JSON-LD décodé (tableau) ou null. Ne bloque jamais la page plus de 3 secondes. */
	public static function get_jsonld() {
		$s = self::settings();
		if ( '' === $s['business_id'] ) {
			return null;
		}
		$key    = self::cache_key( $s );
		$cached = get_transient( $key );
		if ( false !== $cached ) {
			return is_array( $cached ) && ! empty( $cached ) ? $cached : null;
		}
		$url = $s['api_base'] . '/api/schema/' . rawurlencode( $s['business_id'] ) . ( $s['include_faq'] ? '?faq=1' : '' );
		$res = wp_remote_get(
			$url,
			array(
				'timeout'    => 3,
				'headers'    => array( 'Accept' => 'application/ld+json' ),
				'user-agent' => 'RepereWP/' . self::VERSION . '; ' . home_url( '/' ),
			)
		);
		$data = null;
		if ( ! is_wp_error( $res ) && 200 === (int) wp_remote_retrieve_response_code( $res ) ) {
			$decoded = json_decode( wp_remote_retrieve_body( $res ), true );
			if ( is_array( $decoded ) && isset( $decoded['@context'] ) ) {
				$data = $decoded;
			}
		}
		if ( $data ) {
			set_transient( $key, $data, self::CACHE_TTL );
			update_option( self::LAST_GOOD, $data, false );
			return $data;
		}
		// Échec : on sert la dernière version valide et on réessaie dans 15 minutes.
		$last = get_option( self::LAST_GOOD );
		set_transient( $key, is_array( $last ) ? $last : array(), self::RETRY_TTL );
		return is_array( $last ) ? $last : null;
	}

	public static function print_jsonld() {
		if ( is_admin() || is_feed() || is_robots() ) {
			return;
		}
		$s = self::settings();
		if ( 'front' === $s['scope'] && ! is_front_page() ) {
			return;
		}
		$data = self::get_jsonld();
		if ( ! $data ) {
			return;
		}
		// JSON_HEX_TAG : « < » et « > » échappés, la balise ne peut pas être refermée par le contenu.
		$json = wp_json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP );
		if ( $json ) {
			echo "\n<!-- Repéré : balisage schema.org -->\n<script type=\"application/ld+json\">" . $json . "</script>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
	}

	/* ------------------------------------------------------------------ */
	/* Relais des visites des robots IA (sans IP, non bloquant)            */
	/* ------------------------------------------------------------------ */

	public static function relay_bot() {
		$s = self::settings();
		if ( ! $s['bot_relay'] || '' === $s['business_id'] || '' === $s['bot_key'] || is_admin() ) {
			return;
		}
		$ua = isset( $_SERVER['HTTP_USER_AGENT'] ) ? substr( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ), 0, 400 ) : '';
		if ( '' === $ua || ! self::is_ai_bot( $ua ) ) {
			return;
		}
		$uri  = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '/'; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$path = substr( (string) wp_parse_url( $uri, PHP_URL_PATH ), 0, 200 );
		wp_remote_post(
			$s['api_base'] . '/api/t/bot',
			array(
				'blocking' => false,
				'timeout'  => 1,
				'headers'  => array(
					'Content-Type'  => 'application/json',
					'x-repere-key'  => $s['bot_key'],
				),
				'body'     => wp_json_encode(
					array(
						'businessId' => $s['business_id'],
						'ua'         => $ua,
						'path'       => $path ? $path : '/',
					)
				),
			)
		);
	}

	public static function is_ai_bot( $ua ) {
		foreach ( self::AI_BOTS as $bot ) {
			if ( false !== stripos( $ua, $bot ) ) {
				return true;
			}
		}
		return false;
	}

	/* ------------------------------------------------------------------ */
	/* Administration                                                      */
	/* ------------------------------------------------------------------ */

	public static function admin_menu() {
		add_options_page( 'Repéré — référencement IA', 'Repéré', 'manage_options', 'repere-ia', array( __CLASS__, 'render_page' ) );
	}

	public static function register_settings() {
		register_setting( 'repere_ia', self::OPTION, array( 'sanitize_callback' => array( __CLASS__, 'sanitize' ) ) );
	}

	public static function action_links( $links ) {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'options-general.php?page=repere-ia' ) ) . '">Réglages</a>' );
		return $links;
	}

	public static function handle_refresh() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Accès refusé.' );
		}
		check_admin_referer( 'repere_ia_refresh' );
		self::flush_cache();
		self::get_jsonld();
		wp_safe_redirect( admin_url( 'options-general.php?page=repere-ia&refreshed=1' ) );
		exit;
	}

	public static function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$s    = self::settings();
		$o    = self::OPTION;
		$data = '' !== $s['business_id'] ? self::get_jsonld() : null;
		?>
		<div class="wrap">
			<h1>Repéré — référencement IA</h1>
			<?php if ( isset( $_GET['refreshed'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification.Recommended ?>
				<div class="notice notice-success"><p>Balisage rechargé depuis Repéré.</p></div>
			<?php endif; ?>
			<p>Le balisage est inséré dans le &lt;head&gt; par le serveur : Google et les robots des IA le lisent sans exécuter de JavaScript. Il doit décrire des informations visibles sur la page (coordonnées, horaires, produits).</p>
			<form method="post" action="options.php">
				<?php settings_fields( 'repere_ia' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="repere_business_id">Identifiant Repéré</label></th>
						<td><input name="<?php echo esc_attr( $o ); ?>[business_id]" id="repere_business_id" type="text" class="regular-text" value="<?php echo esc_attr( $s['business_id'] ); ?>" />
						<p class="description">Dans Repéré : Tâches → « Balisage » ou Réglages.</p></td>
					</tr>
					<tr>
						<th scope="row">Pages concernées</th>
						<td>
							<label><input type="radio" name="<?php echo esc_attr( $o ); ?>[scope]" value="front" <?php checked( 'front', $s['scope'] ); ?> /> Page d'accueil seulement (recommandé)</label><br />
							<label><input type="radio" name="<?php echo esc_attr( $o ); ?>[scope]" value="all" <?php checked( 'all', $s['scope'] ); ?> /> Toutes les pages</label>
						</td>
					</tr>
					<tr>
						<th scope="row">FAQ</th>
						<td><label><input type="checkbox" name="<?php echo esc_attr( $o ); ?>[include_faq]" value="1" <?php checked( 1, $s['include_faq'] ); ?> /> Inclure le balisage FAQPage</label>
						<p class="description">Uniquement si les mêmes questions et réponses sont affichées sur la page.</p></td>
					</tr>
					<tr>
						<th scope="row">Robots des IA</th>
						<td><label><input type="checkbox" name="<?php echo esc_attr( $o ); ?>[bot_relay]" value="1" <?php checked( 1, $s['bot_relay'] ); ?> /> Signaler à Repéré les visites des robots IA (GPTBot, ClaudeBot, PerplexityBot…)</label>
						<p class="description">Seuls le nom du robot et la page visitée sont transmis. Aucune adresse IP, aucun visiteur humain.</p>
						<p><label for="repere_bot_key">Clé de relais</label><br />
						<input name="<?php echo esc_attr( $o ); ?>[bot_key]" id="repere_bot_key" type="password" class="regular-text" autocomplete="off" value="<?php echo esc_attr( $s['bot_key'] ); ?>" />
						<span class="description">Dans Repéré : Trafic IA → Installation.</span></p></td>
					</tr>
					<tr>
						<th scope="row"><label for="repere_api_base">Adresse de l'API</label></th>
						<td><input name="<?php echo esc_attr( $o ); ?>[api_base]" id="repere_api_base" type="url" class="regular-text" value="<?php echo esc_attr( $s['api_base'] ); ?>" /></td>
					</tr>
				</table>
				<?php submit_button( 'Enregistrer' ); ?>
			</form>
			<?php if ( '' !== $s['business_id'] ) : ?>
				<h2>Balisage actuel</h2>
				<?php if ( $data ) : ?>
					<p>Mis en cache 12 heures. <a href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=repere_ia_refresh' ), 'repere_ia_refresh' ) ); ?>">Recharger maintenant</a></p>
					<pre style="max-height:320px;overflow:auto;background:#fff;border:1px solid #ccd0d4;padding:12px;"><?php echo esc_html( wp_json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) ); ?></pre>
				<?php else : ?>
					<div class="notice notice-warning inline"><p>Impossible de récupérer le balisage : vérifiez l'identifiant (nouvel essai automatique dans 15 minutes).</p></div>
				<?php endif; ?>
			<?php endif; ?>
		</div>
		<?php
	}
}

Repere_IA::init();

register_deactivation_hook(
	__FILE__,
	static function () {
		Repere_IA::flush_cache();
	}
);
