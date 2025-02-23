import { Audio, Collider, ColliderShape, CollisionGroup, GameServer } from 'hytopia';
import type { World, Vector3Like, Player } from 'hytopia';
import ZombieEntity from './enemies/ZombieEntity';
import GamePlayerEntity from './GamePlayerEntity';
import { DirtBlockManager } from './dirtBlocks/DirtBlockManager';
import { DirtGun } from './DirtGun';
import { PlayerStateManager } from './PlayerStateManager';
// temp


export default class GameManager {
  public static readonly instance = new GameManager();

  public isStarted = false;
  public isRoundInProgress = false;
  public unlockedIds: Set<string> = new Set([ 'start' ]);
  public waveNumber = 0;
  public waveDelay = 0;
  public world: World | undefined;

  private readonly MAX_ZOMBIES = 10;
  private readonly SPAWN_INTERVAL_MS = 30000; // Spawn every 30 seconds
  private readonly ROUND_LENGTH_MS = 60000; // 5 minutes per round
  private readonly WAITING_TIME_MS = 30000;  // 30 seconds between rounds
  private _enemySpawnTimeout?: NodeJS.Timer;
  private _roundTimeout?: NodeJS.Timer;
  private activeZombies: Set<ZombieEntity> = new Set();

  private _startTime: number | undefined;
  private dirtBlockManager: DirtBlockManager | undefined;


  public constructor() {

  }

  public addUnlockedId(id: string) {
    this.unlockedIds.add(id);
  }

  public setupGame(world: World, dirtBlockManager: DirtBlockManager) {
    this.dirtBlockManager = dirtBlockManager;
    this.world = world;
    world.chatManager.registerCommand('/startround', () => this.startRound());
  }

  public startRound() {
    if (!this.world || this.isRoundInProgress) return;
    this.isRoundInProgress = true;

    // Teleport all players to game area
    GameServer.instance.playerManager.getConnectedPlayersByWorld(this.world).forEach(player => {
        const entities = this.world!.entityManager.getPlayerEntitiesByPlayer(player);
        entities.forEach(entity => {
            entity.setPosition({ x: 0, y: 75, z: 0 });
        });
    });
    this.dirtBlockManager?.startNewRound();
    this.startGame();
    // End round after ROUND_LENGTH_MS
    this._roundTimeout = setTimeout(() => this.endRound(), this.ROUND_LENGTH_MS);
  }

  private endRound() {
    if (!this.world) return;
    this.isRoundInProgress = false;
    this.stopSpawning();
    this.dirtBlockManager?.cleanupRound();
    
    // Teleport and notify players
    GameServer.instance.playerManager.getConnectedPlayersByWorld(this.world).forEach(player => {
        const entities = this.world!.entityManager.getPlayerEntitiesByPlayer(player);
        entities.forEach(entity => {
            entity.setPosition(this._getWaitingAreaSpawn());
        });
        this.world?.chatManager.sendPlayerMessage(player, 'Round ended! Type /startround to begin a new round', '00FF00');
    });

    // Remove auto-start timer
    // Let players manually start with /startround command
  }


  // Modified player join handler (use in index.ts)
  public handlePlayerJoin(player: Player, world: World, stateManager: PlayerStateManager): GamePlayerEntity {
    if (!this.dirtBlockManager) throw new Error('DirtBlockManager not initialized');
    const playerEntity = new GamePlayerEntity(player, stateManager, this.dirtBlockManager, world);
    const spawnPos = this.isRoundInProgress ? 
                this._getWaitingAreaSpawn() : 
                { x: 0, y: 115, z: 0 };
            
    playerEntity.spawn(world, spawnPos);
    const gun = new DirtGun(world, playerEntity, stateManager);
    playerEntity.equipGun(gun);
    return playerEntity;
  }


  public startGame() {
    if (!this.world || this.isStarted) return; // type guard

    this.isStarted = true;
    this._startTime = Date.now();

    GameServer.instance.playerManager.getConnectedPlayersByWorld(this.world).forEach(player => {
     // player.ui.sendData({ type: 'start' });
    });

    this._spawnLoop();
  }

  private _spawnLoop() {
    if (!this.world) return;
    clearTimeout(this._enemySpawnTimeout);
    // Only spawn if below max zombies
    if (this.activeZombies.size < this.MAX_ZOMBIES) {
        const zombie = new ZombieEntity({
            health: 7,
            speed: 3
        });

        zombie.spawn(this.world, this._getSpawnPoint());
        this.activeZombies.add(zombie);

        // Remove zombie from tracking when it dies/despawns
        zombie.onDespawn = () => {
            this.activeZombies.delete(zombie);
            this.spawnZombie();
        };
    }
    // Continue spawn loop
    this._enemySpawnTimeout = setTimeout(
        () => this._spawnLoop(), 
        this.SPAWN_INTERVAL_MS
    );
  }

  spawnZombie() {
    if (!this.world) return;
    const zombie = new ZombieEntity({
      health: 7 + (this.waveNumber * 0.25),
      speed: Math.min(6, 2 + this.waveNumber * 0.25), // max speed of 6
    });
    zombie.spawn(this.world, this._getSpawnPoint());
    this.activeZombies.add(zombie);
    // Remove zombie from tracking when it dies/despawns
    zombie.onDespawn = () => {
        this.activeZombies.delete(zombie);
        this.spawnZombie();
    };
  }

  private _getSpawnPoint(): Vector3Like {
    const SPAWN_RADIUS_MIN = 4;  // Minimum distance from center
    const SPAWN_RADIUS_MAX = 6; // Maximum distance (just inside flat area)
    const SPAWN_HEIGHT = 25;     // Just above flat area height
    // Get random angle
    const angle = Math.random() * Math.PI * 2;
    // Get random radius between min and max
    const radius = SPAWN_RADIUS_MIN + Math.random() * (SPAWN_RADIUS_MAX - SPAWN_RADIUS_MIN);
    // Convert to cartesian coordinates
    return {
        x: Math.cos(angle) * radius,
        y: SPAWN_HEIGHT,
        z: Math.sin(angle) * radius
    };
  }

  private _getWaitingAreaSpawn(): Vector3Like {
    const SPAWN_RADIUS_MIN = 4;  // Minimum distance from center
    const SPAWN_RADIUS_MAX = 6; // Maximum distance (just inside flat area)
    const SPAWN_HEIGHT = 115;     // Just above flat area height
    // Get random angle
    const angle = Math.random() * Math.PI * 2;
    // Get random radius between min and max
    const radius = SPAWN_RADIUS_MIN + Math.random() * (SPAWN_RADIUS_MAX - SPAWN_RADIUS_MIN);
    // Convert to cartesian coordinates
    return {
        x: Math.cos(angle) * radius,
        y: SPAWN_HEIGHT,
        z: Math.sin(angle) * radius
    };
  }

  // Call this to start spawning
  startSpawning() {
    this._spawnLoop();
  }

  // Call this for cleanup
  stopSpawning() {
    clearTimeout(this._enemySpawnTimeout);
    this.activeZombies.clear();
  }
}
