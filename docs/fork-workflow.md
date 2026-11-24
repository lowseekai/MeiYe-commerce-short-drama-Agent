# Fork 浜屽紑涓庝笂娓稿悓姝ユ祦绋?
鏈粨搴撴槸 fork锛歚origin` = 浣犺嚜宸辩殑浠撳簱锛堝彲鍐欙級锛宍upstream` = 涓婃父 `WMRBYY/MeiYe-commerce-short-drama-Agent`锛堝彧璇伙級銆?鐩爣锛?*闀挎湡浜屽紑銆佷笉鎻?PR銆佷絾涓婃父鏇存柊鑳戒竴鏉″懡浠よ拷涓婏紝涓旀案杩滀笉琚笂娓歌鐩栥€?*

## 0. 杩欏浠撳簱鐨勫舰鎬侊紙鍐冲畾浜嗕簩寮€璇ュ線鍝惤锛?
| 鐩綍 | 鍐呭 | 鎶€鏈爤 |
| --- | --- | --- |
| `backend/` | 鏈嶅姟绔紙`module yingce/backend`锛?| Go 1.25锛孏in锛孲QLite/Postgres + Redis |
| `web/` | 鍓嶇宸ヤ綔鍙帮紙`name: yingce`锛?| Bun 1.3.9 + Vite + React + TS |
| `plugin-packages/` | **妯″瀷娓犻亾 / 鏀粯鎻掍欢**锛宍<id>.yingce-plugin` 娓呭崟 + 鍚屽悕婧愮爜鐩綍 | TS/Node |
| `docker/`銆乣docker-compose*.yml` | 6 濂楃紪鎺掞細`build` / `deploy` / `dev` / `local` / `server` / 榛樿 | Docker |
| `docs/` | 璁捐涓庨儴缃叉枃妗ｏ紙md / mdx锛?| 鈥?|
| `VERSION` | 褰撳墠鐗堟湰鍙凤紝濡?`v1.8.7.1-private-test` | 鈥?|

缁撹锛氳繖涓」鐩?*鏈韩灏辨槸鎻掍欢鍖栬璁?*锛堟ā鍨嬫笭閬撱€佹敮浠橀兘鏄彃浠讹級锛屾墍浠ヤ簩寮€浼樺厛绾у簲璇ユ槸
**鍐欐彃浠?> 鍔犳柊妯″潡 > 鏀逛笂娓告枃浠?*銆傛敼寰楄秺闈犲墠锛屼笂娓告洿鏂版椂鍐茬獊瓒婂皯銆?
## 1. remote 鎷撴墤锛堜竴娆￠厤濂斤級

```bash
git clone git@github.com:lowseekai/MeiYe-commerce-short-drama-Agent.git
cd MeiYe-commerce-short-drama-Agent

git remote add upstream git@github.com:WMRBYY/MeiYe-commerce-short-drama-Agent.git
git remote set-url --push upstream no_push      # 鐗╃悊绂佹璇帹涓婃父

git config rerere.enabled true                  # 璁颁綇鍐茬獊瑙ｆ硶
git config pull.rebase true
git config rebase.autoStash true
```

## 2. 鍒嗘敮妯″瀷

| 鍒嗘敮 | 鑱岃矗 | 閾佸緥 |
| --- | --- | --- |
| `main` | 涓婃父闀滃儚 | 鍙厑璁?fast-forward锛屾案涓嶆彁浜や簩寮€浠ｇ爜 |
| `dev` | 浜屽紑涓荤嚎 | 鎵€鏈変簩寮€鎻愪氦鍦ㄨ繖閲岋紝鍓嶇紑 `[custom]` |
| `feat/*` | 鍗曚釜鍔熻兘 | 浠?`dev` 鍒囷紝`--no-ff` 鍚堝洖 |
| tag `v*-custom.N` | 閮ㄧ讲鐐?| 鏈嶅姟鍣?CI 鍙 tag |

```bash
git checkout -b dev
```

## 3. 鍚屾涓婃父锛堟瘡娆′笂娓稿彂鐗堝悗璺戜竴閬嶏級

```bash
git fetch upstream --tags

git checkout main
git merge --ff-only upstream/main          # 绾揩杩涳紝涓嶄細鍐茬獊
git push origin main

git checkout dev
git rebase main                            # 鍐茬獊锛氭敼瀹?git add -A && git rebase --continue
git push --force-with-lease origin dev
```

鐢?`rebase` 涓嶇敤 `merge`锛氫綘鐨勪簩寮€姘歌繙鏄竴鍙犲共鍑€琛ヤ竵鍙犲湪鏈€鏂颁笂娓镐箣涓婏紝鍐茬獊鍙В涓€娆°€?`dev` 鍙湁浣犺嚜宸辩敤锛屽巻鍙茶鏀瑰啓娌″叧绯伙紱`--force-with-lease` 姣?`-f` 瀹夊叏锛堝埆浜烘帹杩囦細鎷掔粷锛夈€?
## 4. 浜屽紑钀界偣锛堟寜鍐茬獊鎴愭湰浠庝綆鍒伴珮锛?
1. **鎻掍欢灞傦紙棣栭€夛紝闆跺啿绐侊級**锛氬湪 `plugin-packages/` 涓嬫柊寤?`<your>.yingce-plugin` 娓呭崟 + 鍚屽悕婧愮爜鐩綍锛岀収鎶?`openai-chat-completions`銆乣volcengine-ark-seedance` 杩欑被鐜版垚鎻掍欢鐨勭粨鏋勩€傛敮浠樺悓鐞嗙湅 `backend/payment-plugins/`銆?2. **鍓嶇鏂板姛鑳?*锛氭柊澧?`web/src/features/<your-feature>/`锛屽彧鍦ㄨ矾鐢?鍏ュ彛澶勫仛鏈€灏忔敼鍔紙涓€涓よ娉ㄥ唽锛夛紝涓嶈閲嶆帓涓婃父椤甸潰銆?3. **鍚庣鏂版ā鍧?*锛氭柊澧?`backend/internal/<your-module>/`锛屽湪 `backend/cmd/` 閲屾敞鍐岃矾鐢憋紱闇€瑕佹柊琛ㄥ氨璧?migration 鏂版枃浠讹紝涓嶆敼鏃?migration銆?4. **閰嶇疆涓庣紪鎺?*锛氭柊澧炰綘鑷繁鐨?`docker-compose.fork.yml`銆乣.env`锛坄.gitignore` 宸插拷鐣?`.env`銆乣.env.*`锛屽彧鏀捐 `.env.example`锛夛紝**涓嶈鏀逛笂娓搁偅 6 涓?compose**銆?5. **鏈€鍚庢墠鐩存帴鏀逛笂娓告枃浠?*锛氭敼鍔ㄥ敖閲忓皬銆佹垚鍧楋紝鏂逛究 rebase 鏃惰瘑鍒€?
## 5. 鍐茬獊鐑偣涓庡鐞?
| 鏂囦欢 | 澶勭悊 |
| --- | --- |
| `web/bun.lock` | 涓嶈鎵?merge锛歚git checkout --theirs web/bun.lock && (cd web && bun install)` |
| `backend/go.sum` | 鍚屼笂锛歚git checkout --theirs backend/go.sum && (cd backend && go mod tidy)` |
| `VERSION` | 淇濇寔涓婃父鍊硷紝鑷繁鐨勭増鏈敤 tag 琛ㄨ揪锛屽埆鏀硅繖涓枃浠?|
| `docker-compose*.yml` / `nginx.conf` | 涓€寰嬭蛋浣犺嚜宸辩殑 `*.fork.yml` 瑕嗙洊锛屼笉鍔ㄤ笂娓?|
| `docs/content/**`锛坢dx 鏂囨。锛?| 涓婃父甯告敼锛屼簩寮€鏂囨。鍗曠嫭鏀?`docs/fork/` |
| 澶ц寖鍥存牸寮忓寲 | **绂佹**瀵逛笂娓告枃浠惰窇 `bun run format` / `prettier --write .`锛屼細鎶婃暣涓粨搴撳彉鎴愬啿绐佹簮 |

寤鸿 `.gitattributes` 杩藉姞锛堝凡鏈?`plugin-packages/*.sh` 鐨?eol 瑙勫垯锛屽埆鍒狅級锛?
```gitattributes
web/bun.lock        -merge
backend/go.sum      -merge
```

## 6. 鐗堟湰涓庨儴缃?
```bash
# 鎵撻儴缃茬偣锛氫笂娓哥増鏈?+ 浣犵殑搴忓彿
git tag -a v1.8.7.1-custom.1 -m "deploy 2026-11-24"
git push origin v1.8.7.1-custom.1

# 鏈嶅姟鍣ㄦ寜 tag 閮ㄧ讲锛屼笉鍦ㄦ湁鏈湴鏀瑰姩鐨勫伐浣滃尯 git pull
git fetch --tags && git checkout -f v1.8.7.1-custom.1
```

- 涓婃父鏂囨。鏄庣‘锛氭湇鍔″櫒榛樿鏂规鏄畼鏂?Release 闀滃儚 + `docker-compose.deploy.yml` + Host Updater銆?  浜屽紑涔嬪悗浣犺蛋鐨勬槸**鑷缓闀滃儚**锛屾墍浠ヨ鏀惧純闈㈡澘閲岀殑鍦ㄧ嚎鏇存柊閫氶亾锛屾敼鎴愯嚜宸辩殑 tag 鈫?鏋勫缓 鈫?閮ㄧ讲銆?- 闀滃儚 tag 鐩存帴鐢?`v1.8.7.1-custom.1`锛宍git describe --tags` 灏辫兘瀵逛笂銆岃窇鐨勬槸鍝釜涓婃父鐗堟湰 + 浜屽紑绗嚑鐗堛€嶃€?
## 7. 涓婃父鏇存柊鎰熺煡

- 鏈€浣庢垚鏈細瀹氭湡鐪?fork 椤甸潰鐨?`Sync fork` 鎸夐挳锛堢瓑浠蜂簬鎶?`upstream/main` 鍚堣繘浣犵殑 `main`锛夈€?- 鑷姩鍖栵細鍦?`.github/workflows/` 鍔犱竴涓?cron锛堟瘡澶?`git fetch upstream && git merge --ff-only upstream/main` 鍚?push `main`锛夛紝涓婃父鍔ㄤ簡 `main` 浼氳嚜鍔ㄥ墠杩涳紝浣犲彧闇€鍦ㄨ嚜宸辨柟渚挎椂 rebase `dev`銆?- 閫氱煡锛歐atch 涓婃父浠撳簱閫?`Custom 鈫?Releases only`锛屽彂鐗堟椂鏀堕偖浠躲€?
## 8. 鍛戒护閫熸煡

```bash
git fetch upstream --tags                  # 鎷変笂娓?git log --oneline dev..upstream/main       # 涓婃父鏂板浜嗕粈涔?git diff --stat main...dev                 # 浣犳敼浜嗗摢浜涙枃浠讹紙浜屽紑鍏ㄨ矊锛?git rebase main                            # 鎶婁簩寮€鍨埌鏈€鏂颁笂娓?git rebase --abort                         # 鎼炵牳浜嗗洖婊?git rerere status                          # 鐪嬭浣忕殑鍐茬獊瑙ｆ硶
git describe --tags                        # 褰撳墠閮ㄧ讲鐗堟湰
```
