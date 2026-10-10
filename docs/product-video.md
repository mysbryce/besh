# Product video

The [Besh product film](assets/besh-product.mp4) is an original, local English 60-second presentation with music and interaction sounds. React/SVG interfaces use continuing simulated state, without screenshot swaps. They illustrate implemented workflows; they do not call a real backend or provide browser execution proof.

The maintainer approved this final cut and requested README placement on 2026-10-10. Clicks highlight controls; drops pulse existing ports and animate edges without moving endpoints. These effects add no product capabilities. The README embeds the approved MP4 through a GitHub attachment; the original remains tracked and editable marketing files remain local.

[PR #13](https://github.com/mysbryce/besh/pull/13) delivered the approved README link and film as source version `0.20.4-alpha.0`. Its [exact-head CI](https://github.com/mysbryce/besh/actions/runs/38054518624) and [post-merge main CI](https://github.com/mysbryce/besh/actions/runs/38054945566) passed core, browser and compiled-portable jobs. This does not publish a new executable release or establish continuous audio/video playback verification.

## GitHub player

The maintainer subsequently requested an inline player. Source `0.20.6-alpha.0` replaces the README download link with the [GitHub attachment](https://github.com/user-attachments/assets/15d58a79-3a1c-4dad-93f8-c1918cfddcd8) on its own line. GitHub renders standalone video attachment URLs as players; see [attachment instructions](https://docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli).

The unchanged approved MP4 was attached to PR #13 using GitHub CLI `--attach`. An anonymous download returned 14,006,330 bytes with the SHA-256 recorded below. No re-encoding or new cut was required. The editable movie project stays ignored, and the public portable download stays at `0.19.0-alpha.0`.

The public PR attachment rendered a visible player with controls in a headless Chromium check. Muted playback advanced beyond one second with 1920 × 1080 video, 60.011-second duration and no media error. This verifies decoding and initial playback, not full-length playback or listening.

## Sequence

| Time        | Composition and action                                                          |
| ----------- | ------------------------------------------------------------------------------- |
| 0–5 s       | Centered kinetic Besh title and floating example data.                          |
| 5–13 s      | Centered upload interface, then a table close-up.                               |
| 13–23 s     | Full canvas, picker/inspector close-ups, edge drops and explicit `$data` reply. |
| 23–32.3 s   | Separate save, busy test/result and publication; a readable live-state hold.    |
| 32.3–34.3 s | Dark full-frame original “See it. Test it. Ship it.” typography.                |
| 34.3–41.5 s | Immersive roles, runtime-key and audit navigation.                              |
| 41.5–47.6 s | Separate Welcome endpoint k6 setup and observed local sample metrics.           |
| 47.6–54 s   | Appearance/language switching and an explicitly external phone viewport reveal. |
| 54–57 s     | Centered setup card; required setup key blank, Create disabled.                 |
| 57–60 s     | Quiet centered logo and project call to action.                                 |

Authored names, paths and data stay literal. Saving and publication remain distinct. The separate Welcome sample does not predict production capacity. No private credentials appear.

## Artifact receipt

The corrected local render passed movie types, render and verification. Earlier cuts are superseded.

| Item    | Final value                                                        |
| ------- | ------------------------------------------------------------------ |
| Bytes   | 14,006,330                                                         |
| SHA-256 | `d1bb6ed01db21b9b1667e96edcadfde6850524be7eea18c5d699c887d0b3f914` |

Verified output is H.264, `yuv420p`, 1920 × 1080, 30 fps, 1800 decoded frames and 60.000 seconds of video, with stereo 48 kHz AAC audio. Container duration is 60.011 seconds.

## Provenance and review

The original 144 BPM instrumental and 32 interaction sounds follow 29 clicks, two drops and one delete. Existing locally bundled Google Sans Flex and Noto Sans Thai materials retain their [font manifest](../web/assets/font-manifest.json), [Google Sans Flex license](../web/assets/google-sans-flex-OFL.txt), [trademark notice](../web/assets/google-sans-flex-TRADEMARKS.txt) and [Noto Sans Thai license](../web/assets/noto-sans-thai-OFL.txt). Remotion 4.0.534 has [separate upstream terms](https://github.com/remotion-dev/remotion/blob/v4.0.534/LICENSE.md).

The ohmygame reference informed composition through 1853 decoded frames on 62 contact sheets with 320 × 180 tiles. No assets, text or music were copied; continuous playback/audio audition was unobserved.

Review covered 266 prior cinematic stills and 171 decoded reaction-cut frames at original detail. Final export yielded 171 sampled frames: 76 match reviewed PNG hashes; all 95 changed originals passed visual review after the spotlight-corner correction. Repository checks passed 361 tests/6368 assertions, types, Vite build and formatting; they do not prove playback quality. Audio mean −18.3 dB/max −4.1 dB is numeric evidence only. Maintainer design approval is recorded above; continuous playback and listening were not independently observed by the agents.

Remotion tooling, source, audio and stills under `marketing/` are local and ignored, unavailable from a fresh clone. Only the final MP4 is retained.
