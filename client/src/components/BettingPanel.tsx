"use client";

import { Button } from "primereact/button";
import { InputNumber } from "primereact/inputnumber";
import { Toast } from "primereact/toast";
import { useRef, useState } from "react";
import { useGame, useCurrentPlayer } from "@/context/GameContext";
import { placeBet } from "@/lib/socket";

export function BankDisplay() {
  const { room } = useGame();
  if (!room || room.status === "lobby") return null;

  return (
    <div className="player-card p-3 mb-3 flex align-items-center justify-content-between">
      <span className="text-500">Banca</span>
      <span className="score-badge text-xl">🏦 {room.bank} 🍌</span>
    </div>
  );
}

export function BettingPanel() {
  const { room, playerId } = useGame();
  const currentPlayer = useCurrentPlayer();
  const [betAmount, setBetAmount] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const toast = useRef<Toast>(null);

  if (!room?.currentRound) return null;
  if (room.status !== "betting" && room.status !== "revealed") return null;

  const round = room.currentRound;
  const myBet = round.bets.find((b) => b.playerId === playerId);
  const bettingOpen = round.status === "open";
  const winner = round.winnerId
    ? room.players.find((p) => p.id === round.winnerId)
    : null;

  const handlePlaceBet = async () => {
    if (!betAmount || betAmount < 1) {
      toast.current?.show({
        severity: "warn",
        summary: "Inserisci un numero valido",
      });
      return;
    }

    setLoading(true);
    const result = await placeBet(betAmount);
    setLoading(false);

    if (!result.success) {
      toast.current?.show({
        severity: "error",
        summary: "Errore",
        detail: result.error,
      });
      return;
    }

    toast.current?.show({
      severity: "success",
      summary: "Puntata piazzata!",
      detail: `${betAmount} 🍌`,
    });
  };

  return (
    <>
      <Toast ref={toast} />
      <div className="player-card p-4 mb-3">
        <h3 className="mt-0">Round {room.roundNumber}</h3>

        {round.status === "revealed" && winner && round.winningBet !== null && (
          <div className="mb-3">
            <p className="text-green-400 font-bold mb-2">
              Vincitore: {winner.name} con {round.winningBet} 🍌
            </p>
            <p className="text-500 m-0">
              Guadagno: {round.winnerPayout} 🍌 ({round.winningBet} −{" "}
              {round.secondHighestBet})
            </p>
            <p className="text-500 mt-1 mb-0">Banca +{round.bankIncrease} 🍌</p>
          </div>
        )}

        {round.status === "revealed" && (
          <ul className="list-none p-0 m-0 mb-3">
            {[...round.bets]
              .sort((a, b) => b.amount - a.amount)
              .map((bet) => {
                const player = room.players.find((p) => p.id === bet.playerId);
                const isWinner = bet.playerId === round.winnerId;
                return (
                  <li
                    key={bet.playerId}
                    className={`py-2 border-bottom-1 border-800 ${isWinner ? "text-green-400 font-bold" : ""}`}
                  >
                    {player?.name || "Giocatore"}: {bet.amount} 🍌
                    {isWinner && " ✓"}
                  </li>
                );
              })}
          </ul>
        )}

        {bettingOpen && (
          <div className="flex flex-column gap-3">
            <p className="text-500 m-0">
              Quante banane vuoi puntare? Vince la puntata più alta.
            </p>
            <div className="flex align-items-center gap-2">
              <label htmlFor="bet-amount">La tua puntata</label>
              <span className="text-500 ml-auto">
                Disponibili: {currentPlayer?.bananas ?? 0} 🍌
              </span>
            </div>
            <InputNumber
              id="bet-amount"
              value={betAmount}
              onValueChange={(e) => setBetAmount(e.value ?? 1)}
              min={1}
              showButtons
              className="w-full"
            />
            {myBet && (
              <p className="text-yellow-400 m-0">
                Puntata attuale: {myBet.amount} 🍌
              </p>
            )}
            <Button
              label={myBet ? "Aggiorna puntata" : "Piazza puntata"}
              icon="pi pi-wallet"
              onClick={handlePlaceBet}
              loading={loading}
              disabled={!currentPlayer || currentPlayer.bananas < 1}
            />
            <p className="text-500 m-0">
              Puntate ricevute: {round.bets.length} / {room.players.length}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
