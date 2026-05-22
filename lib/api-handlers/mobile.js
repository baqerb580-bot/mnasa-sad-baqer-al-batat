// Auto-extracted handler module
import { ok, err, getJsonBody, logActivity } from './_helpers';

export async function handleMobile(ctx) {
  const { path, method, request, db, clientIp } = ctx;

  if (path === 'mobile-app/info' && method === 'GET') {
    try {
      const fs = await import('fs');
      const fsp = fs.promises;
      const pathMod = await import('path');
      const configPath = pathMod.join(process.cwd(), 'capacitor.config.json');
      let config = {};
      try {
        config = JSON.parse(await fsp.readFile(configPath, 'utf-8'));
      } catch {}

      // Compute android folder size (excluding build artifacts)
      const androidPath = pathMod.join(process.cwd(), 'android');
      let totalSize = 0;
      let fileCount = 0;
      const SKIP_DIRS = new Set(['build', '.gradle', '.idea', 'captures']);
      async function walk(dir) {
        try {
          const items = await fsp.readdir(dir, { withFileTypes: true });
          for (const item of items) {
            if (SKIP_DIRS.has(item.name)) continue;
            const full = pathMod.join(dir, item.name);
            if (item.isDirectory()) {
              await walk(full);
            } else if (item.isFile()) {
              try {
                const st = await fsp.stat(full);
                totalSize += st.size;
                fileCount++;
              } catch {}
            }
          }
        } catch {}
      }
      try { await walk(androidPath); } catch {}

      // Check if android project exists
      const exists = fs.existsSync(androidPath);

      return ok({
        appId: config.appId || 'com.ghazlan.erp',
        appName: config.appName || 'مركز الغزلان',
        serverUrl: config.server?.url || process.env.NEXT_PUBLIC_BASE_URL || '',
        projectExists: exists,
        projectSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        fileCount,
        capacitorConfig: config,
        plugins: ['@capacitor/core', '@capacitor/app', '@capacitor/splash-screen', '@capacitor/status-bar'],
      });
    } catch (e) {
      console.error('[mobile-app/info] error:', e?.message);
      return err('Failed to load mobile app info: ' + e.message, 500);
    }
  }

  if (path === 'mobile-app/download-project' && method === 'GET') {
    try {
      const fs = await import('fs');
      const fsp = fs.promises;
      const pathMod = await import('path');
      const os = await import('os');
      const { execFile } = await import('child_process');

      const projectRoot = process.cwd();
      const androidPath = pathMod.join(projectRoot, 'android');

      if (!fs.existsSync(androidPath)) {
        return err('Android project not found', 404);
      }

      // Prepare temp staging dir
      const tmpDir = await fsp.mkdtemp(pathMod.join(os.tmpdir(), 'ghazlan-apk-'));
      const stageDir = pathMod.join(tmpDir, 'ghazlan-android');
      await fsp.mkdir(stageDir, { recursive: true });

      // Use rsync to copy android/ excluding build artifacts
      await new Promise((resolve, reject) => {
        execFile('rsync', [
          '-a',
          '--exclude=build',
          '--exclude=.gradle',
          '--exclude=.idea',
          '--exclude=captures',
          '--exclude=*.iml',
          androidPath + '/',
          pathMod.join(stageDir, 'android') + '/',
        ], (err2) => err2 ? reject(err2) : resolve());
      });

      // Add capacitor.config.json
      const capConfigPath = pathMod.join(projectRoot, 'capacitor.config.json');
      if (fs.existsSync(capConfigPath)) {
        await fsp.copyFile(capConfigPath, pathMod.join(stageDir, 'capacitor.config.json'));
      }

      // Add build docs
      const buildDocPath = pathMod.join(projectRoot, 'ANDROID_BUILD.md');
      if (fs.existsSync(buildDocPath)) {
        await fsp.copyFile(buildDocPath, pathMod.join(stageDir, 'ANDROID_BUILD.md'));
      }

      // Minimal package.json
      const pkgJsonContent = JSON.stringify({
        name: 'ghazlan-android-build',
        version: '1.0.0',
        description: 'Android project for مركز الغزلان ERP. See ANDROID_BUILD.md',
        scripts: {
          'sync': 'npx cap sync android',
          'build:debug': 'cd android && ./gradlew assembleDebug',
          'build:release': 'cd android && ./gradlew assembleRelease',
          'open': 'npx cap open android',
        },
        dependencies: {
          '@capacitor/core': '^6.0.0',
          '@capacitor/cli': '^6.0.0',
          '@capacitor/android': '^6.0.0',
          '@capacitor/app': '^6.0.0',
          '@capacitor/splash-screen': '^6.0.0',
          '@capacitor/status-bar': '^6.0.0',
        },
      }, null, 2);
      await fsp.writeFile(pathMod.join(stageDir, 'package.json'), pkgJsonContent);

      // Minimal web placeholder dir
      await fsp.mkdir(pathMod.join(stageDir, 'capacitor-web'), { recursive: true });
      await fsp.writeFile(
        pathMod.join(stageDir, 'capacitor-web/index.html'),
        '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>مركز الغزلان</title><style>body{margin:0;background:#0a0a0a;color:#d4af37;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh}</style></head><body>جاري الاتصال…</body></html>'
      );

      // README at root
      await fsp.writeFile(pathMod.join(stageDir, 'README.md'),
        `# مركز الغزلان - Android APK Project\n\n## بناء سريع\n\`\`\`bash\nyarn install\nnpx cap sync android\ncd android && ./gradlew assembleDebug\n\`\`\`\n\nالـ APK في: \`android/app/build/outputs/apk/debug/app-debug.apk\`\n\nراجع \`ANDROID_BUILD.md\` لمزيد من التفاصيل.\n`
      );

      // ZIP it using system zip command
      const zipName = `ghazlan-android-${new Date().toISOString().slice(0,10)}.zip`;
      const zipPath = pathMod.join(tmpDir, zipName);
      await new Promise((resolve, reject) => {
        execFile('zip', ['-r', '-q', zipPath, 'ghazlan-android'], { cwd: tmpDir, maxBuffer: 200 * 1024 * 1024 }, (err2) => err2 ? reject(err2) : resolve());
      });

      const buffer = await fsp.readFile(zipPath);

      // Cleanup tmp (async, don't await)
      fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});

      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${zipName}"`,
          'Content-Length': String(buffer.length),
          'Cache-Control': 'no-store',
        },
      });
    } catch (e) {
      console.error('[mobile-app/download-project] error:', e?.stack || e?.message);
      return err('Failed to create zip: ' + e.message, 500);
    }
  }




  return null; // not handled by this module
}
