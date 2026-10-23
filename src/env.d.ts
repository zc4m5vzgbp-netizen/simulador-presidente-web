// Importaciones de estilos gestionadas por esbuild.
declare module '*.css';

/**
 * true solo en la compilación de VISTA PREVIA privada (npm run build:artifact):
 * activa la herramienta de verificación que acelera el reloj. En la compilación
 * web publicable es false y el código se elimina.
 */
declare const __PREVIEW__: boolean;
