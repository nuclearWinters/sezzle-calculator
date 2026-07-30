package httpapi

import (
	"log"
	"net/http"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

type syncRequest struct {
	Cursor *string `json:"cursor"`
}

func (a *API) HistorySyncHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, wsAcceptOptions())
	if err != nil {
		log.Printf("websocket accept failed: %v", err)
		return
	}
	defer conn.CloseNow()

	ctx := r.Context()

	if a.History == nil {
		conn.Close(websocket.StatusInternalError, "history is not available")
		return
	}

	var req syncRequest
	if err := wsjson.Read(ctx, conn, &req); err != nil {
		conn.Close(websocket.StatusPolicyViolation, `expected a JSON {"cursor"} payload`)
		return
	}

	raw := ""
	if req.Cursor != nil {
		raw = *req.Cursor
	}
	cursor, err := parseCursor(raw)
	if err != nil {
		conn.Close(websocket.StatusPolicyViolation, "invalid cursor")
		return
	}

	entries, err := a.History.ListSince(ctx, cursor)
	if err != nil {
		log.Printf("failed to list history since cursor: %v", err)
		conn.Close(websocket.StatusInternalError, "failed to load history")
		return
	}

	for _, entry := range entries {
		if err := wsjson.Write(ctx, conn, toHistoryItem(entry)); err != nil {
			log.Printf("failed to write history sync message: %v", err)
			return
		}
	}

	conn.Close(websocket.StatusNormalClosure, "")
}

func wsAcceptOptions() *websocket.AcceptOptions {
	origin := allowedOrigin()
	if origin == "*" {
		return &websocket.AcceptOptions{InsecureSkipVerify: true}
	}
	return &websocket.AcceptOptions{OriginPatterns: []string{origin}}
}
