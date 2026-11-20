import { enrichBundleWithUtm } from "../core/utm.js";
import type { TablighDatabase } from "../db/database.js";
import { PLATFORM_STUDIO_URLS, type PublishBundle } from "../types.js";

/**
 * Seeds realistic multi-episode Indonesian & global omnichannel data into SQLite
 * so `npm run demo` starts an immediately interactive Control Plane on :8791.
 */
export function seedDemoData(db: TablighDatabase): void {
  if (db.listEpisodes().length > 0) {
    return;
  }

  const ep1Raw: PublishBundle = {
    schemaVersion: "1.0",
    episodeId: "ep-2026-wakaf-produktif",
    title: "Arsitektur Wakaf Produktif Berbasis Cashflow Riil & Transparansi Edge",
    pillar: "Tabligh",
    sourceType: "demo",
    sourcePath: "examples/wakaf-produktif.md",
    canonicalUrl: "https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
    targets: [
      {
        platform: "emdash",
        format: "posts",
        transport: "official_api",
        title: "Arsitektur Wakaf Produktif Berbasis Cashflow Riil",
        slug: "wakaf-produktif-cashflow-riil",
        collection: "posts",
        excerpt: "Bagaimana dana wakaf dikelola seperti infrastruktur produktif dengan audit ledger real-time.",
        tldr: "Wakaf produktif bukan sekadar penghimpunan aset pasif, melainkan mesin arus kas abadi yang diaudit terbuka.",
        body: "Wakaf produktif membutuhkan disiplin keuangan tingkat infrastruktur: pemisahan pokok abadi (mawquf), tata kelola surplus nazhir, dan pelaporan publik berbasis ledger yang dapat diverifikasi setiap donatur secara real-time.",
        ctaUrl: "https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
      },
      {
        platform: "x",
        format: "thread",
        transport: "official_api",
        body: "Kenapa banyak proyek wakaf produktif berhenti di seremoni peresmian? Masalahnya bukan niat baik — melainkan desain cashflow. (Thread)",
        threadItems: [
          "1/ Banyak proyek wakaf produktif gagal bukan karena kurang donatur, tapi karena pokok aset tidak dipisah tegas dari biaya operasi.",
          "2/ Di arsitektur wakaf modern, pokok aset dikunci sebagai endowment, sementara hasil sewa & margin usaha dialirkan ke penerima manfaat + cadangan pemeliharaan.",
          "3/ Baca cetak biru sistem & model audit real-time-nya di ridlo.id: https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
        ],
        tags: ["wakafproduktif", "islamicfinance", "buildinpublic"],
        ctaUrl: "https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
      },
      {
        platform: "linkedin",
        format: "post",
        transport: "official_api",
        body: "Mengelola wakaf produktif membutuhkan ketegasan tata kelola layaknya infrastructure fund.\n\nTiga prinsip inti yang kami terapkan:\n1. Pemisahan mutlak antara pokok wakaf dan surplus operasional.\n2. Pelaporan dampak & arus kas yang bisa diaudit publik.\n3. Insentif berkelanjutan bagi nazhir profesional.\n\nEsai lengkap: https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
        tags: ["WakafProduktif", "Governance", "Indonesia"],
        ctaUrl: "https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
      },
      {
        platform: "threads",
        format: "post",
        transport: "official_api",
        body: "Catatan sore: wakaf produktif yang sehat seharusnya membosankan di sisi akuntansi dan menggembirakan di sisi manfaat umat. Detail arsitekturnya: https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
        ctaUrl: "https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
      },
      {
        platform: "whatsapp_channel",
        format: "broadcast",
        transport: "official_api",
        body: "*Esai Baru: Arsitektur Wakaf Produktif Berbasis Cashflow Riil*\n\nBagaimana merancang mesin arus kas wakaf yang transparan dan tahan krisis? Baca catatan lengkapnya: https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
        ctaUrl: "https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
      },
      {
        platform: "youtube",
        format: "long",
        transport: "official_api",
        scheduledAt: "2026-11-22T12:00:00+08:00",
        title: "Bedah Arsitektur Wakaf Produktif: Dari Cashflow Riil ke Audit Ledger",
        body: "Pembahasan mendalam arsitektur keuangan wakaf produktif dan pelaporan transparan.\n\nBaca esai sumber: https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
        tags: ["wakaf", "fintech", "indonesia"],
        ctaUrl: "https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
        media: [{ path: "examples/agentic-short-pack/sample-faststart.mp4", type: "video", width: 1920, height: 1080, durationSec: 780 }],
      },
      {
        platform: "tiktok",
        format: "video",
        transport: "cdp_draft",
        useTrendingAudio: true,
        body: "Kesalahan terbesar proyek wakaf produktif: mencampur dana pokok dengan biaya operasional! Ini cara memisahnya dengan rapi.\n\nCek blueprint lengkap: https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
        tags: ["wakafproduktif", "edukasikeuangan", "islamindonesia", "cashflow"],
        ctaUrl: "https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
        media: [{ path: "examples/agentic-short-pack/sample-faststart.mp4", type: "video", width: 1080, height: 1920, durationSec: 54 }],
      },
      {
        platform: "instagram",
        format: "reels",
        transport: "cdp_draft",
        useTrendingAudio: true,
        body: "Bagaimana dana wakaf bisa membiayai manfaat sosial terus-menerus tanpa habis tergerus inflasi?\n\nSimak bedah alurnya di Reels ini dan baca cetak biru lengkapnya via link di bio: https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
        tags: ["wakafproduktif", "ekonomisyariah", "transparansi", "ridloid"],
        ctaUrl: "https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
        media: [{ path: "examples/agentic-short-pack/sample-faststart.mp4", type: "video", width: 1080, height: 1920, durationSec: 54 }],
      },
    ],
  };

  const ep2Raw: PublishBundle = {
    schemaVersion: "1.0",
    episodeId: "ep-2026-physical-approval-gate",
    title: "Mengapa AI Agent Butuh Physical Approval Gate di Era Anti-Bot",
    pillar: "Tabligh",
    sourceType: "demo",
    canonicalUrl: "https://ridlo.id/notes/physical-approval-gate",
    targets: [
      {
        platform: "emdash",
        format: "notes",
        transport: "official_api",
        title: "Physical Approval Gate untuk Publikasi Berisiko Tinggi",
        slug: "physical-approval-gate",
        collection: "notes",
        body: "Otomasi penuh pada platform anti-bot ketat seperti TikTok Web berisiko memicu shadowban atau suspensi akun. Physical Approval Gate menempatkan agent sebagai juru siapkan draf (validasi media, moov faststart, caption, UTM), sementara klik Publish tetap dilakukan manusia.",
        ctaUrl: "https://ridlo.id/notes/physical-approval-gate",
      },
      {
        platform: "youtube",
        format: "shorts",
        transport: "official_api",
        title: "Kenapa AI Tidak Boleh Asal Klik Publish di TikTok",
        body: "Penjelasan singkat pola Hybrid Dual-Transport + Physical Approval Gate di tabligh-os.\n\nCatatan ZK: https://ridlo.id/notes/physical-approval-gate",
        tags: ["aiagent", "automation", "tablighos"],
        ctaUrl: "https://ridlo.id/notes/physical-approval-gate",
        media: [{ path: "examples/agentic-short-pack/sample-faststart.mp4", type: "video", width: 1080, height: 1920, durationSec: 46 }],
      },
      {
        platform: "tiktok",
        format: "video",
        transport: "cdp_draft",
        useTrendingAudio: true,
        body: "Jangan biarkan bot mengklik tombol Publish di akun utama Anda. Pakai pola Physical Approval Gate: AI menyiapkan semua validasi & caption, manusia yang pegang kendali akhir.\n\nBaca note-nya: https://ridlo.id/notes/physical-approval-gate",
        tags: ["aiagent", "typescript", "contentops", "tablighos"],
        ctaUrl: "https://ridlo.id/notes/physical-approval-gate",
        media: [{ path: "examples/agentic-short-pack/sample-faststart.mp4", type: "video", width: 1080, height: 1920, durationSec: 46 }],
      },
      {
        platform: "x",
        format: "thread",
        transport: "official_api",
        scheduledAt: "2026-11-23T09:00:00+08:00",
        body: "Otomasi tanpa rem di platform anti-bot = jalan cepat menuju shadowban. Ini alasan tabligh-os memaksa Physical Approval Gate.",
        threadItems: [
          "1/ Official API (YouTube, X, LinkedIn, EmDash) aman dijadwalkan otomatis setelah lolos validator deterministik.",
          "2/ TikTok Web & IG Trending Audio berhenti di PENDING_HUMAN_CLICK dengan paket siap klik Publish: https://ridlo.id/notes/physical-approval-gate",
        ],
        ctaUrl: "https://ridlo.id/notes/physical-approval-gate",
      },
      {
        platform: "linkedin",
        format: "post",
        transport: "official_api",
        scheduledAt: "2026-11-23T10:30:00+08:00",
        body: "Dalam membangun sistem publikasi agentic, pertanyaan terpenting bukan hanya apa yang bisa diotomasi — tetapi di mana manusia harus memegang kendali fisik.\n\nSelengkapnya: https://ridlo.id/notes/physical-approval-gate",
        ctaUrl: "https://ridlo.id/notes/physical-approval-gate",
      },
      {
        platform: "instagram",
        format: "carousel",
        transport: "official_api",
        body: "5 alasan kenapa AI Agent perlu Physical Approval Gate sebelum merilis konten di platform sosial.\n\nBaca catatan: https://ridlo.id/notes/physical-approval-gate",
        tags: ["aiworkflow", "engineering", "tablighos"],
        ctaUrl: "https://ridlo.id/notes/physical-approval-gate",
        media: [
          { path: "examples/agentic-short-pack/slide-1.png", type: "image", width: 1080, height: 1350 },
          { path: "examples/agentic-short-pack/slide-2.png", type: "image", width: 1080, height: 1350 },
        ],
      },
    ],
  };

  const ep3Raw: PublishBundle = {
    schemaVersion: "1.0",
    episodeId: "ep-2026-bi-qadri-uqulihim",
    title: "Tabligh OS: Distribusi Konten Omnichannel Sesuai Karakteristik Audiens",
    pillar: "Tabligh",
    sourceType: "demo",
    canonicalUrl: "https://ridlo.id/posts/tabligh-os-bi-qadri-uqulihim",
    targets: [
      {
        platform: "emdash",
        format: "posts",
        transport: "official_api",
        title: "Tabligh OS: Operasionalisasi Prinsip Bi Qadri Uqulihim",
        slug: "tabligh-os-bi-qadri-uqulihim",
        collection: "posts",
        body: "Satu gagasan inti tidak pernah boleh disalin-tempel mentah ke delapan platform. Prinsip Bi qadri 'uqulihim menuntut adaptasi format, kedalaman, dan panggilan bertindak sesuai nalar audiens tiap kanal.",
        ctaUrl: "https://ridlo.id/posts/tabligh-os-bi-qadri-uqulihim",
      },
      {
        platform: "x",
        format: "tweet",
        transport: "official_api",
        body: "Copy-paste satu teks ke 8 platform bukanlah omnichannel — itu spam terdistribusi. Prinsip Bi qadri 'uqulihim menuntut adaptasi native per kanal: https://ridlo.id/posts/tabligh-os-bi-qadri-uqulihim",
        ctaUrl: "https://ridlo.id/posts/tabligh-os-bi-qadri-uqulihim",
      },
      {
        platform: "linkedin",
        format: "post",
        transport: "official_api",
        body: "Satu tesis mendalam dapat hidup dalam 8 bentuk yang masing-masing terasa native:\n• Esai kanonik di EmDash\n• Thread tajam di X\n• Kerangka strategis di LinkedIn\n• Broadcast ringkas di WhatsApp Channel\n\nKlik Run Dry-Run di dashboard untuk simulasi state machine: https://ridlo.id/posts/tabligh-os-bi-qadri-uqulihim",
        ctaUrl: "https://ridlo.id/posts/tabligh-os-bi-qadri-uqulihim",
      },
      {
        platform: "threads",
        format: "post",
        transport: "official_api",
        body: "Berbicara sesuai kadar akal & kebiasaan audiens di tiap platform membuat satu riset panjang terasa hidup sepanjang minggu: https://ridlo.id/posts/tabligh-os-bi-qadri-uqulihim",
        ctaUrl: "https://ridlo.id/posts/tabligh-os-bi-qadri-uqulihim",
      },
      {
        platform: "whatsapp_channel",
        format: "broadcast",
        transport: "official_api",
        body: "*Rilis Mingguan Tabligh OS*\n\nMengubah 1 artikel riset menjadi paket distribusi lintas 8 kanal dengan atribusi edge-funnel otomatis: https://ridlo.id/posts/tabligh-os-bi-qadri-uqulihim",
        ctaUrl: "https://ridlo.id/posts/tabligh-os-bi-qadri-uqulihim",
      },
      {
        platform: "tiktok",
        format: "video",
        transport: "cdp_draft",
        useTrendingAudio: true,
        body: "Satu tulisan panjang bisa jadi 8 konten berbeda tanpa terasa robotik. Begini alur kerjanya dengan tabligh-os.\n\nSelengkapnya: https://ridlo.id/posts/tabligh-os-bi-qadri-uqulihim",
        tags: ["contentdistribution", "omnichannel", "tablighos"],
        ctaUrl: "https://ridlo.id/posts/tabligh-os-bi-qadri-uqulihim",
        media: [{ path: "examples/agentic-short-pack/sample-faststart.mp4", type: "video", width: 1080, height: 1920, durationSec: 49 }],
      },
    ],
  };

  const ep1 = enrichBundleWithUtm(ep1Raw);
  const ep2 = enrichBundleWithUtm(ep2Raw);
  const ep3 = enrichBundleWithUtm(ep3Raw);

  const res1 = db.upsertEpisodeAndJobs(ep1, { initialStatus: "PLANNED" });
  for (const job of res1.jobs) {
    db.transitionJobStatus(job.id, "VALIDATED", {}, "Demo pre-flight validated");
    db.transitionJobStatus(job.id, "UPLOADING", {}, `Demo dispatch (${job.transport})`);
    if (job.platform === "tiktok" || job.platform === "instagram") {
      db.transitionJobStatus(
        job.id,
        "PENDING_HUMAN_CLICK",
        {
          stagingPath: `data/staging/${job.episodeId}/${job.platform}-${job.format}/draft-packet.json`,
          studioUrl: PLATFORM_STUDIO_URLS[job.platform],
        },
        "Staged for Physical Approval Gate (siap klik Publish)",
      );
    } else if (job.platform === "youtube") {
      db.transitionJobStatus(
        job.id,
        "SCHEDULED",
        {
          publishedUrl: "https://youtube.com/watch?v=yt-wakaf-2026",
          externalId: "yt-wakaf-2026",
        },
        "Scheduled via YouTube Data API v3",
      );
    } else {
      const urls: Record<string, string> = {
        emdash: "https://ridlo.id/posts/wakaf-produktif-cashflow-riil",
        x: "https://x.com/ridloabelian/status/1899001122",
        linkedin: "https://www.linkedin.com/feed/update/urn:li:share:7301122334/",
        threads: "https://www.threads.net/@ridloabelian/post/C8Wakaf01",
        whatsapp_channel: "https://whatsapp.com/channel/tabligh/ep-2026-wakaf",
      };
      db.transitionJobStatus(
        job.id,
        "PUBLISHED",
        {
          publishedUrl: urls[job.platform] ?? null,
          externalId: `demo-${job.platform}-ep1`,
        },
        "Published via Official API transport",
      );
    }
  }

  const res2 = db.upsertEpisodeAndJobs(ep2, { initialStatus: "PLANNED" });
  for (const job of res2.jobs) {
    db.transitionJobStatus(job.id, "VALIDATED", {}, "Demo pre-flight validated");
    if (job.platform === "instagram") {
      continue; // stays VALIDATED
    }
    db.transitionJobStatus(job.id, "UPLOADING", {}, `Demo dispatch (${job.transport})`);
    if (job.platform === "tiktok") {
      db.transitionJobStatus(
        job.id,
        "PENDING_HUMAN_CLICK",
        {
          stagingPath: `data/staging/${job.episodeId}/tiktok-video/draft-packet.json`,
          studioUrl: PLATFORM_STUDIO_URLS.tiktok,
        },
        "Staged for TikTok Web Physical Approval Gate",
      );
    } else if (job.platform === "x" || job.platform === "linkedin") {
      db.transitionJobStatus(
        job.id,
        "SCHEDULED",
        {
          publishedUrl:
            job.platform === "x"
              ? "https://x.com/ridloabelian/status/scheduled-ep2"
              : "https://www.linkedin.com/feed/update/urn:li:share:scheduled-ep2/",
        },
        "Scheduled via Official API transport",
      );
    } else {
      db.transitionJobStatus(
        job.id,
        "PUBLISHED",
        {
          publishedUrl:
            job.platform === "emdash"
              ? "https://ridlo.id/notes/physical-approval-gate"
              : "https://youtube.com/shorts/yt-gate-2026",
        },
        "Published via Official API transport",
      );
    }
  }

  const res3 = db.upsertEpisodeAndJobs(ep3, { initialStatus: "PLANNED" });
  for (const job of res3.jobs) {
    if (job.platform !== "tiktok") {
      db.transitionJobStatus(job.id, "VALIDATED", {}, "Ready for runner execution");
    }
  }

  db.logNotification({
    episodeId: "ep-2026-wakaf-produktif",
    channel: "waflare",
    status: "sent",
    summary:
      "TABLIGH OS · 5 Official API channels PUBLISHED, 1 SCHEDULED, 2 PENDING_HUMAN_CLICK (TikTok, IG Reels).",
    responseCode: 200,
    error: null,
  });

  db.logNotification({
    episodeId: "ep-2026-physical-approval-gate",
    channel: "telegram",
    status: "sent",
    summary:
      "TABLIGH OS · YouTube Shorts & EmDash PUBLISHED; TikTok awaiting human click at http://localhost:8791.",
    responseCode: 200,
    error: null,
  });
}
