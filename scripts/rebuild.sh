#!/usr/bin/env bash
# rebuild.sh — 造幕（create.doingfb.com）构建 / 发布 / 健康校验
#
# 用法:
#   rebuild.sh web        只重建并发布前端
#   rebuild.sh backend    只重建并发布后端（自动处理 plugin_registry 摘要冲突）
#   rebuild.sh all        两个都做（默认）
#
# 设计要点:
#   1. build 前先把当前镜像打成 :prev，失败可回滚
#   2. web 一律用 --force-recreate：compose 常误判"无需重建"，导致容器挂在旧镜像上
#   3. backend 启动前移走 /data/plugin_registry.json：镜像内插件包摘要变了会让后端反复重试后 exit 1
#   4. 每个容器都做 health 轮询，超时即判定失败
#   5. 发布后校验「卷内入口 chunk == 镜像内入口 chunk」

set -uo pipefail

REPO=${REPO:-/srv/repos/MeiYe-commerce-short-drama-Agent}
PROJECT=${PROJECT:-meiye-commerce-short-drama-agent}
BACKEND_TIMEOUT=${BACKEND_TIMEOUT:-240}
WEB_TIMEOUT=${WEB_TIMEOUT:-180}

TARGET=${1:-all}
case "$TARGET" in
    web|backend|all) ;;
    -h|--help|help)
        sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
        exit 0 ;;
    *)
        echo "未知目标: $TARGET（可选 web | backend | all）" >&2
        exit 2 ;;
esac

cd "$REPO" || { echo "仓库不存在: $REPO" >&2; exit 1; }

DC=(sudo docker compose -f docker-compose.local.yml -f docker-compose.fork.yml)
BACKEND_CTN="$PROJECT-backend-1"
WEB_CTN="$PROJECT-web-1"
DATA_VOL="/var/lib/docker/volumes/${PROJECT}_backend-data/_data"
STAMP=$(date +%Y%m%d-%H%M%S)
FAILED=0
MOVED_REGISTRY=0

hr() { printf '%.0s─' {1..64}; echo; }
log() { printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }

# ---------- 健康轮询 ----------
wait_healthy() {
    local name=$1 timeout=$2 elapsed=0 st
    while (( elapsed < timeout )); do
        st=$(sudo docker inspect --format '{{.State.Health.Status}}' "$name" 2>/dev/null || echo missing)
        case "$st" in
            healthy) echo "  ✅ $name healthy（${elapsed}s）"; return 0 ;;
            missing) echo "  ❌ $name 容器不存在"; return 1 ;;
        esac
        sleep 4; elapsed=$((elapsed + 4))
    done
    echo "  ❌ $name 超过 ${timeout}s 仍未 healthy（最后状态: $st）"
    return 1
}

# ---------- 回滚快照 ----------
snapshot() {
    local img=$1
    if sudo docker image inspect "$img" >/dev/null 2>&1; then
        sudo docker tag "$img" "${img%:local}:prev" && echo "  📦 已保存回滚镜像 ${img%:local}:prev"
    fi
}
rollback() {
    local img=$1 ctn=$2
    echo "  ↩️  回滚到 ${img%:local}:prev"
    sudo docker tag "${img%:local}:prev" "$img" || return 1
    "${DC[@]}" up -d --force-recreate "$ctn" >/dev/null 2>&1 || true
    wait_healthy "$PROJECT-$ctn-1" 180
}

# ---------- 前置信息 ----------
hr
echo "造幕 rebuild.sh   $(date '+%F %T')"
echo "仓库: $REPO"
echo "HEAD: $(git log -1 --format='%h %s' 2>/dev/null || echo '(非 git 仓库)')"
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "⚠️  工作区有未提交改动（构建会包含它们）："
    git status --short | head -5
fi
echo "目标: $TARGET"
hr

# ================= web =================
if [ "$TARGET" = "web" ] || [ "$TARGET" = "all" ]; then
    log "1/3 快照 + 构建 web 镜像"
    snapshot open-ai-canvas-web:local
    if ! "${DC[@]}" build web 2>&1 | tail -3; then
        echo "❌ web 镜像构建失败，未做任何发布"; exit 1
    fi

    log "2/3 强制重建 web 容器（--force-recreate）"
    "${DC[@]}" up -d --force-recreate web 2>&1 | tail -3

    log "3/3 健康校验"
    if ! wait_healthy "$WEB_CTN" "$WEB_TIMEOUT"; then
        echo "❌ web 未通过健康检查"
        rollback open-ai-canvas-web:local web || true
        exit 1
    fi

    # 卷内入口 == 镜像内入口
    VOL_ENTRY=$(sudo docker exec "$WEB_CTN" sh -c 'grep -oE "/assets/index-[A-Za-z0-9_-]+\.js" /usr/share/nginx/html/index.html | head -1' 2>/dev/null)
    IMG_ENTRY=$(sudo docker exec "$WEB_CTN" sh -c 'grep -oE "/assets/index-[A-Za-z0-9_-]+\.js" /opt/canvas-release/index.html | head -1' 2>/dev/null)
    echo "  卷内入口: $VOL_ENTRY"
    echo "  镜像入口: $IMG_ENTRY"
    if [ "$VOL_ENTRY" != "$IMG_ENTRY" ] || [ -z "$VOL_ENTRY" ]; then
        echo "  ❌ 入口 chunk 不一致（发布未生效）"
        FAILED=1
    else
        echo "  ✅ 发布一致"
    fi
fi

# ================= backend =================
if [ "$TARGET" = "backend" ] || [ "$TARGET" = "all" ]; then
    log "1/4 快照 + 构建 backend 镜像"
    snapshot open-ai-canvas-backend:local
    if ! "${DC[@]}" build backend 2>&1 | tail -3; then
        echo "❌ backend 镜像构建失败，未做任何发布"; exit 1
    fi

    log "2/4 移走 plugin_registry.json（避免插件包摘要冲突导致启动失败）"
    # 注意：$DATA_VOL 是 root 700 权限，普通用户 [ -f ] 永远返回 false，
    # 必须用 sudo test，否则会跳过移走动作、后端随后因插件摘要冲突反复重启后 exit 1。
    if sudo test -f "$DATA_VOL/plugin_registry.json"; then
        if sudo mv "$DATA_VOL/plugin_registry.json" "$DATA_VOL/plugin_registry.json.moved-$STAMP"; then
            MOVED_REGISTRY=1
            echo "  📦 已备份为 plugin_registry.json.moved-$STAMP"
        else
            echo "  ⚠️  移走失败，继续尝试启动（可能因摘要冲突失败）"
        fi
    else
        echo "  （无注册表，跳过）"
    fi

    log "3/4 重建 backend 容器"
    "${DC[@]}" up -d --force-recreate backend 2>&1 | tail -3

    log "4/4 健康校验"
    if ! wait_healthy "$BACKEND_CTN" "$BACKEND_TIMEOUT"; then
        echo "❌ backend 未通过健康检查"
        if [ "$MOVED_REGISTRY" = "1" ]; then
            sudo mv "$DATA_VOL/plugin_registry.json.moved-$STAMP" "$DATA_VOL/plugin_registry.json" 2>/dev/null || true
            echo "  ↩️  已还原 plugin_registry.json"
        fi
        rollback open-ai-canvas-backend:local backend || true
        exit 1
    fi
    echo "  ✅ 插件注册表已按新镜像自动重建"
fi

# ---------- 汇总 ----------
log "汇总"
"${DC[@]}" ps --format 'table {{.Name}}\t{{.Status}}'
echo
echo "API 健康: $(curl -s -m 10 http://127.0.0.1:3100/api/health | head -c 120)"
echo

if [ "$FAILED" -ne 0 ]; then
    echo "⚠️  有校验项未通过，请检查上面的输出"
    exit 1
fi
echo "✅ 完成 $(date '+%F %T')"
