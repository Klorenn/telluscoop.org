// Category-level content templates for Tellus Dev tool detail pages (dev/tool.html).
// One set of templated strings per category id — reused across every tool in that
// category with the tool's own name/tags/free-tier text substituted in.
// Wording/structure verified against https://itsfree.dev/es tool detail pages
// (InsForge, Vercel, Groq, Clerk, Deno Deploy checked directly) then extended to the
// remaining categories in the same voice.
window.TELLUS_DEV_CATEGORY_CONTENT = {
  hosting: {
    shortVersionExtra: {
      es: "Elimina trabajo de infraestructura entre un repositorio y una URL pública, facilitando probar ideas, compartir previews y lanzar productos pequeños.",
      en: "It removes infrastructure busywork between a repository and a public URL, making it easy to test ideas, share previews and launch small products.",
    },
    useCases: {
      es: [
        "Publicar un portfolio o documentación con dominio propio.",
        "Crear un entorno de preview por cada pull request.",
        "Lanzar un MVP sin mantener servidores de despliegue.",
      ],
      en: [
        "Publish a portfolio or documentation site with a custom domain.",
        "Create a preview environment for every pull request.",
        "Launch an MVP without maintaining deployment servers.",
      ],
    },
    tryTitle: { es: "Publica un proyecto de fin de semana", en: "Ship a weekend project" },
    trySteps: {
      es: [
        "Conecta el repositorio y selecciona el preset del framework.",
        "Añade variables de entorno y comprueba el deploy de preview.",
        "Conecta un dominio, activa analítica y vigila la cuota gratuita.",
      ],
      en: [
        "Connect the repository and pick the framework preset.",
        "Add environment variables and check the preview deploy.",
        "Connect a domain, turn on analytics and keep an eye on the free quota.",
      ],
    },
    caveat2: {
      es: "Comprueba políticas de suspensión, restricciones de uso comercial, ancho de banda y qué ocurre al agotar la cuota.",
      en: "Check suspension policies, commercial-use restrictions, bandwidth limits and what happens once the quota runs out.",
    },
    idealFor: {
      es: "Proyectos frontend, APIs, demos y pequeños servicios en producción",
      en: "Frontend projects, APIs, demos and small production services",
    },
  },

  data: {
    shortVersionExtra: {
      es: "Proporciona infraestructura de datos gestionada para persistir, consultar y sincronizar información sin operar un clúster desde cero.",
      en: "It provides managed data infrastructure so an application can persist, query and synchronize information without operating a database cluster from scratch.",
    },
    useCases: {
      es: [
        "Dar persistencia a un prototipo SaaS.",
        "Crear una base aislada para previews y pruebas automáticas.",
        "Validar un modelo de datos antes de elegir infraestructura de producción.",
      ],
      en: [
        "Back a SaaS prototype with persistent application data.",
        "Create an isolated database for previews and automated tests.",
        "Validate a data model before committing to production infrastructure.",
      ],
    },
    tryTitle: { es: "Construye el backend de una app pequeña", en: "Build the backend for a small app" },
    trySteps: {
      es: [
        "Crea la base gratuita más pequeña y copia sus credenciales.",
        "Aplica un esquema y añade datos de prueba representativos.",
        "Configura alertas y prueba la exportación antes de guardar datos importantes.",
      ],
      en: [
        "Create the smallest free database and copy its connection credentials.",
        "Apply a schema and seed it with representative test data.",
        "Set up usage alerts and test export before storing anything important.",
      ],
    },
    caveat2: {
      es: "Mide por separado storage, cómputo, lecturas/escrituras, backups e inactividad; rara vez comparten el mismo límite.",
      en: "Measure storage, compute, reads/writes, backups and idle policies separately — they rarely share the same limit.",
    },
    idealFor: {
      es: "Prototipos, backends y cargas que necesitan persistencia gestionada",
      en: "Prototypes, backends and workloads that need managed persistence",
    },
  },

  ai: {
    shortVersionExtra: {
      es: "Ayuda a crear, evaluar u operar funciones de IA sin construir primero todo el stack de modelos, trazas y experimentación.",
      en: "It helps build, evaluate or operate AI features without first building the entire model, tracing and experimentation stack.",
    },
    useCases: {
      es: [
        "Comparar prompts o modelos con un pequeño set de evaluación.",
        "Añadir IA a un prototipo manteniendo el uso medible.",
        "Trazar fallos, latencia y coste antes de un lanzamiento mayor.",
      ],
      en: [
        "Compare prompts or models with a small evaluation set.",
        "Add AI to a prototype while keeping usage measurable.",
        "Trace failures, latency and cost before a bigger launch.",
      ],
    },
    tryTitle: { es: "Prototipa un asistente de IA", en: "Prototype an AI assistant" },
    trySteps: {
      es: [
        "Empieza con una tarea concreta y un set de pruebas pequeño.",
        "Registra entradas, salidas, latencia y feedback durante la iteración.",
        "Fija un límite de uso y compara la calidad antes de escalar tráfico.",
      ],
      en: [
        "Start with one concrete task and a small test set.",
        "Log inputs, outputs, latency and feedback while iterating.",
        "Set a usage cap and compare quality before scaling traffic.",
      ],
    },
    caveat2: {
      es: "La plataforma puede ser gratis mientras la inferencia se factura en otro proveedor. Trata ambas cuotas por separado.",
      en: "The platform itself may be free while inference is billed by another provider — track both quotas separately.",
    },
    idealFor: {
      es: "Prototipos con LLM, experimentos, evaluaciones y observabilidad de IA",
      en: "LLM prototypes, experiments, evaluations and AI observability",
    },
  },

  auth: {
    shortVersionExtra: {
      es: "Sustituye la infraestructura sensible de identidad por flujos, SDKs y gestión de usuarios mantenidos.",
      en: "It replaces sensitive identity infrastructure with maintained flows, SDKs and user management.",
    },
    useCases: {
      es: [
        "Añadir login por email, social o passwordless a un MVP.",
        "Modelar equipos y organizaciones en un producto multi-tenant.",
        "Proteger un dashboard interno sin construir infraestructura de identidad.",
      ],
      en: [
        "Add email, social or passwordless login to an MVP.",
        "Model teams and organizations in a multi-tenant product.",
        "Protect an internal dashboard without building identity infrastructure.",
      ],
    },
    tryTitle: { es: "Añade un login preparado para crecer", en: "Add a login that's ready to grow" },
    trySteps: {
      es: [
        "Integra el SDK y activa solo los métodos de login necesarios.",
        "Protege rutas de servidor y prueba la recuperación de cuenta.",
        "Exporta identificadores y documenta una vía de salida antes de lanzar.",
      ],
      en: [
        "Integrate the SDK and enable only the login methods you need.",
        "Protect server routes and test account recovery.",
        "Export user identifiers and document an exit path before launching.",
      ],
    },
    caveat2: {
      es: "Compara cómo se calculan los usuarios activos, límites de organizaciones, MFA y el salto de precio tras la cuota.",
      en: "Compare how active users are counted, organization limits, MFA and the price jump once you exceed the quota.",
    },
    idealFor: {
      es: "Login, gestión de usuarios y organizaciones para productos SaaS",
      en: "Login, user management and organizations for SaaS products",
    },
  },

  email: {
    shortVersionExtra: {
      es: "Se encarga de la entrega, el formato y el seguimiento del correo o los formularios, en vez de tener que mantener un servidor SMTP propio.",
      en: "It handles delivery, formatting and tracking for email or forms instead of you having to run your own SMTP server.",
    },
    useCases: {
      es: [
        "Enviar confirmaciones y notificaciones transaccionales desde una app.",
        "Recoger leads o respuestas de un formulario sin backend propio.",
        "Probar plantillas de email antes de enviarlas a usuarios reales.",
      ],
      en: [
        "Send transactional confirmations and notifications from an app.",
        "Collect leads or form responses without a custom backend.",
        "Test email templates before sending them to real users.",
      ],
    },
    tryTitle: { es: "Envía tu primer email transaccional", en: "Send your first transactional email" },
    trySteps: {
      es: [
        "Verifica un dominio y genera una clave de API.",
        "Envía un email o formulario de prueba y revisa los logs de entrega.",
        "Configura un webhook o notificación para los envíos fallidos.",
      ],
      en: [
        "Verify a domain and generate an API key.",
        "Send a test email or form submission and check the delivery logs.",
        "Set up a webhook or notification for failed sends.",
      ],
    },
    caveat2: {
      es: "Los límites de envíos/día suelen ser más estrictos que los de envíos/mes; planifica picos de tráfico con eso en mente.",
      en: "Daily sending limits are usually stricter than monthly ones — plan for traffic spikes with that in mind.",
    },
    idealFor: {
      es: "Emails transaccionales, formularios y notificaciones para proyectos pequeños",
      en: "Transactional email, forms and notifications for small projects",
    },
  },

  observability: {
    shortVersionExtra: {
      es: "Da visibilidad sobre errores, uptime o rendimiento en producción sin tener que montar tu propio stack de monitorización.",
      en: "It gives visibility into errors, uptime or performance in production without having to build your own monitoring stack.",
    },
    useCases: {
      es: [
        "Detectar caídas de un servicio antes de que las reporten los usuarios.",
        "Diagnosticar un error en producción con contexto y trazas.",
        "Publicar una página de estado pública para tu proyecto.",
      ],
      en: [
        "Catch a service outage before users report it.",
        "Diagnose a production error with context and traces.",
        "Publish a public status page for your project.",
      ],
    },
    tryTitle: { es: "Monitoriza tu primer servicio", en: "Monitor your first service" },
    trySteps: {
      es: [
        "Agrega el SDK o el monitor de uptime a tu proyecto.",
        "Genera un error o caída de prueba y confirma que llega la alerta.",
        "Ajusta la frecuencia de checks y los canales de notificación.",
      ],
      en: [
        "Add the SDK or uptime monitor to your project.",
        "Trigger a test error or outage and confirm the alert arrives.",
        "Tune check frequency and notification channels.",
      ],
    },
    caveat2: {
      es: "La retención de logs y eventos gratuita suele ser corta; exporta lo importante antes de que expire.",
      en: "Free log and event retention is usually short — export anything important before it expires.",
    },
    idealFor: {
      es: "Errores, uptime, logs y alertas para proyectos en producción",
      en: "Errors, uptime, logs and alerts for projects in production",
    },
  },

  ci: {
    shortVersionExtra: {
      es: "Automatiza builds, tests y despliegues junto al código, evitando pasos manuales repetitivos.",
      en: "It automates builds, tests and deployments alongside your code, avoiding repetitive manual steps.",
    },
    useCases: {
      es: [
        "Correr tests automáticamente en cada pull request.",
        "Automatizar el build y deploy de un proyecto pequeño.",
        "Escanear código o dependencias en busca de problemas antes de mergear.",
      ],
      en: [
        "Run tests automatically on every pull request.",
        "Automate the build and deploy of a small project.",
        "Scan code or dependencies for issues before merging.",
      ],
    },
    tryTitle: { es: "Automatiza tu primer pipeline", en: "Automate your first pipeline" },
    trySteps: {
      es: [
        "Define un pipeline mínimo con install, test y build.",
        "Corre el pipeline en un pull request real y revisa los logs.",
        "Agrega un paso de notificación o badge de estado al repositorio.",
      ],
      en: [
        "Define a minimal pipeline with install, test and build steps.",
        "Run the pipeline on a real pull request and check the logs.",
        "Add a notification step or status badge to the repository.",
      ],
    },
    caveat2: {
      es: "Los minutos o créditos gratis suelen ser por repos privados; los públicos casi siempre corren aparte.",
      en: "Free minutes or credits are usually scoped to private repos — public ones almost always run separately.",
    },
    idealFor: {
      es: "Pipelines de test, build y despliegue para repos personales o de equipo",
      en: "Test, build and deploy pipelines for personal or team repositories",
    },
  },

  analytics: {
    shortVersionExtra: {
      es: "Ayuda a entender el uso real de un producto sin tener que construir un pipeline de analítica propio.",
      en: "It helps understand real product usage without having to build your own analytics pipeline.",
    },
    useCases: {
      es: [
        "Medir qué páginas o funciones usa la gente de verdad.",
        "Armar un funnel simple para ver dónde se cae la conversión.",
        "Validar una hipótesis de producto con datos reales de uso.",
      ],
      en: [
        "Measure which pages or features people actually use.",
        "Build a simple funnel to see where conversion drops off.",
        "Validate a product hypothesis with real usage data.",
      ],
    },
    tryTitle: { es: "Mide el uso de tu primer proyecto", en: "Measure usage on your first project" },
    trySteps: {
      es: [
        "Agrega el script o SDK de analítica al sitio o app.",
        "Define 2 o 3 eventos clave y confirma que se registran.",
        "Arma un dashboard simple y revísalo semanalmente.",
      ],
      en: [
        "Add the analytics script or SDK to the site or app.",
        "Define 2 or 3 key events and confirm they're being tracked.",
        "Build a simple dashboard and check it weekly.",
      ],
    },
    caveat2: {
      es: "Los eventos gratis se cuentan distinto en cada herramienta; compáralos sobre el mismo volumen antes de decidir.",
      en: "Free event quotas are counted differently by each tool — compare them at the same volume before deciding.",
    },
    idealFor: {
      es: "Analítica de producto o web para validar uso real",
      en: "Product or web analytics to validate real usage",
    },
  },

  api: {
    shortVersionExtra: {
      es: "Ahorra tiempo de integración ofreciendo datos, mocks o automatizaciones listos para consumir por API.",
      en: "It saves integration time by offering data, mocks or automations that are ready to consume through an API.",
    },
    useCases: {
      es: [
        "Simular una API externa mientras se construye el frontend.",
        "Automatizar una tarea repetitiva entre dos servicios.",
        "Probar una integración antes de pagar por el servicio real.",
      ],
      en: [
        "Mock an external API while building the frontend.",
        "Automate a repetitive task between two services.",
        "Test an integration before paying for the real service.",
      ],
    },
    tryTitle: { es: "Conecta tu primera automatización", en: "Wire up your first automation" },
    trySteps: {
      es: [
        "Genera una clave de API o un endpoint de prueba.",
        "Conecta dos pasos simples y corre una ejecución de prueba.",
        "Revisa los logs y agrega manejo de errores antes de depender de eso.",
      ],
      en: [
        "Generate an API key or a test endpoint.",
        "Connect two simple steps and run a test execution.",
        "Check the logs and add error handling before relying on it.",
      ],
    },
    caveat2: {
      es: "Las cuotas gratis suelen medirse en peticiones o ejecuciones/mes; vigila los picos, no solo el promedio.",
      en: "Free quotas are usually measured in requests or runs per month — watch the spikes, not just the average.",
    },
    idealFor: {
      es: "Mocks, automatizaciones y APIs de utilidad para prototipos",
      en: "Mocks, automations and utility APIs for prototypes",
    },
  },

  design: {
    shortVersionExtra: {
      es: "Facilita diseñar, prototipar o producir assets visuales sin licencias costosas desde el día uno.",
      en: "It makes it easier to design, prototype or produce visual assets without expensive licenses from day one.",
    },
    useCases: {
      es: [
        "Diseñar una interfaz o prototipo antes de escribir código.",
        "Producir assets gráficos para redes o materiales de marketing.",
        "Colaborar con un equipo sobre un mismo archivo de diseño.",
      ],
      en: [
        "Design an interface or prototype before writing code.",
        "Produce graphic assets for social media or marketing materials.",
        "Collaborate with a team on the same design file.",
      ],
    },
    tryTitle: { es: "Diseña tu primera pantalla", en: "Design your first screen" },
    trySteps: {
      es: [
        "Arranca desde una plantilla o un lienzo en blanco.",
        "Invita a un colaborador y prueba comentarios en tiempo real.",
        "Exporta o entrega los assets al equipo de desarrollo.",
      ],
      en: [
        "Start from a template or a blank canvas.",
        "Invite a collaborator and try real-time comments.",
        "Export or hand off the assets to the development team.",
      ],
    },
    caveat2: {
      es: "Los archivos o proyectos compartidos gratis suelen tener un tope bajo; contá cuántos vas a necesitar en simultáneo.",
      en: "Free shared files or projects usually have a low cap — count how many you'll actually need at once.",
    },
    idealFor: {
      es: "Diseño de UI, prototipado y producción de assets visuales",
      en: "UI design, prototyping and visual asset production",
    },
  },

  security: {
    shortVersionExtra: {
      es: "Ayuda a detectar riesgos de seguridad —secretos, dependencias o headers— antes de que lleguen a producción.",
      en: "It helps catch security risks — secrets, dependencies or headers — before they reach production.",
    },
    useCases: {
      es: [
        "Escanear un repositorio en busca de credenciales filtradas.",
        "Revisar dependencias de un proyecto antes de un release.",
        "Auditar los headers de seguridad de un sitio en producción.",
      ],
      en: [
        "Scan a repository for leaked credentials.",
        "Review a project's dependencies before a release.",
        "Audit the security headers of a site in production.",
      ],
    },
    tryTitle: { es: "Haz tu primer escaneo de seguridad", en: "Run your first security scan" },
    trySteps: {
      es: [
        "Conecta el repositorio o pega la URL a analizar.",
        "Corre el escaneo inicial y revisa los hallazgos por severidad.",
        "Arregla lo crítico primero y programa escaneos recurrentes.",
      ],
      en: [
        "Connect the repository or paste the URL to analyze.",
        "Run the initial scan and review findings by severity.",
        "Fix the critical issues first and schedule recurring scans.",
      ],
    },
    caveat2: {
      es: "Un plan gratis para uso individual no siempre cubre a un equipo completo; revisa el límite de miembros.",
      en: "A free plan for individual use doesn't always cover a full team — check the member limit.",
    },
    idealFor: {
      es: "Detección de secretos, dependencias y hardening básico de seguridad",
      en: "Secret detection, dependency scanning and basic security hardening",
    },
  },

  collaboration: {
    shortVersionExtra: {
      es: "Centraliza tareas, documentos o conversaciones de equipo en un solo lugar en vez de depender de planillas sueltas.",
      en: "It centralizes team tasks, docs or conversations in one place instead of relying on scattered spreadsheets.",
    },
    useCases: {
      es: [
        "Organizar el backlog de un proyecto chico con un equipo reducido.",
        "Centralizar documentación y decisiones de producto.",
        "Coordinar una sesión de trabajo remota con el equipo.",
      ],
      en: [
        "Organize the backlog of a small project with a lean team.",
        "Centralize product documentation and decisions.",
        "Coordinate a remote working session with the team.",
      ],
    },
    tryTitle: { es: "Organiza tu primer proyecto", en: "Organize your first project" },
    trySteps: {
      es: [
        "Crea un espacio o tablero para el proyecto.",
        "Invita al equipo y define una estructura simple de tareas o docs.",
        "Revisa el uso a las dos semanas antes de sumar más gente.",
      ],
      en: [
        "Create a workspace or board for the project.",
        "Invite the team and define a simple structure for tasks or docs.",
        "Review usage after two weeks before adding more people.",
      ],
    },
    caveat2: {
      es: "Los planes gratis suelen limitar historial, integraciones o tableros; medí eso contra el uso real del equipo.",
      en: "Free plans usually cap history, integrations or boards — measure that against your team's real usage.",
    },
    idealFor: {
      es: "Tareas, documentos y comunicación para equipos chicos",
      en: "Tasks, docs and communication for small teams",
    },
  },

  cms: {
    shortVersionExtra: {
      es: "Separa el contenido del código para que editores y developers puedan trabajar en paralelo sin pisarse.",
      en: "It separates content from code so editors and developers can work in parallel without stepping on each other.",
    },
    useCases: {
      es: [
        "Modelar contenido estructurado para un sitio o blog.",
        "Dar a un equipo editorial un panel propio sin tocar el código.",
        "Servir el mismo contenido a varias plataformas desde una sola fuente.",
      ],
      en: [
        "Model structured content for a site or blog.",
        "Give an editorial team its own panel without touching code.",
        "Serve the same content to multiple platforms from a single source.",
      ],
    },
    tryTitle: { es: "Modela tu primer tipo de contenido", en: "Model your first content type" },
    trySteps: {
      es: [
        "Define un modelo de contenido simple (por ejemplo, artículos).",
        "Carga contenido de prueba y consúltalo desde la API o SDK.",
        "Invita a un editor y prueba el flujo de publicación completo.",
      ],
      en: [
        "Define a simple content model (for example, articles).",
        "Add sample content and query it from the API or SDK.",
        "Invite an editor and test the full publishing flow.",
      ],
    },
    caveat2: {
      es: "Los límites de peticiones API y usuarios editoriales gratis suelen ser el primer techo real; medilos por separado.",
      en: "Free API request limits and editorial seats are usually the first real ceiling — measure them separately.",
    },
    idealFor: {
      es: "CMS headless para blogs, sitios de contenido y multi-plataforma",
      en: "Headless CMS for blogs, content sites and multi-platform delivery",
    },
  },

  media: {
    shortVersionExtra: {
      es: "Se encarga de subir, transformar y entregar imágenes o vídeo por CDN sin montar tu propia infraestructura de media.",
      en: "It handles uploading, transforming and delivering images or video through a CDN without you building your own media infrastructure.",
    },
    useCases: {
      es: [
        "Subir y optimizar imágenes de usuario en una app.",
        "Servir vídeo o imágenes con buen rendimiento desde un CDN.",
        "Redimensionar o recortar imágenes automáticamente al vuelo.",
      ],
      en: [
        "Upload and optimize user-generated images in an app.",
        "Serve video or images with good performance from a CDN.",
        "Resize or crop images automatically on the fly.",
      ],
    },
    tryTitle: { es: "Sube tu primer archivo", en: "Upload your first file" },
    trySteps: {
      es: [
        "Sube un archivo de prueba con el widget o la API.",
        "Aplica una transformación básica (resize, formato) y comprueba la entrega por CDN.",
        "Mide el consumo de storage y ancho de banda antes de integrarlo a producción.",
      ],
      en: [
        "Upload a test file with the widget or the API.",
        "Apply a basic transformation (resize, format) and check CDN delivery.",
        "Measure storage and bandwidth usage before wiring it into production.",
      ],
    },
    caveat2: {
      es: "Storage, transformaciones y ancho de banda casi nunca comparten la misma cuota gratis; revisa los tres por separado.",
      en: "Storage, transformations and bandwidth almost never share the same free quota — check all three separately.",
    },
    idealFor: {
      es: "Subida, transformación y entrega de imagen o vídeo",
      en: "Upload, transformation and delivery of images or video",
    },
  },
};
