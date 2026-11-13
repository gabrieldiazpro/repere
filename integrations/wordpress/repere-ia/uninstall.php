<?php
/** Désinstallation : supprime les réglages et le cache du plugin Repéré. */
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}
delete_option( 'repere_ia_settings' );
delete_option( 'repere_ia_jsonld_last' );
global $wpdb;
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '\\_transient\\_repere\\_ia\\_ld\\_%' OR option_name LIKE '\\_transient\\_timeout\\_repere\\_ia\\_ld\\_%'" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
