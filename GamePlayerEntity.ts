import { 
    Audio,
    CollisionGroup,
    Light,
    LightType,
    Player,
    PlayerEntity,
    PlayerCameraMode,
    SceneUI,
    PlayerUI,
    World,
    Quaternion,
    PlayerEntityController,
    Vector3,
  } from 'hytopia';
  import { MyPlayerController } from './MyPlayerController';
  import { PlayerStateManager } from './PlayerStateManager';
  import { DirtBlockManager } from './dirtBlocks/DirtBlockManager';
  

  import { DirtGun } from './DirtGun';
  const BASE_HEALTH = 100;

  
  export default class GamePlayerEntity extends PlayerEntity {
    public health: number;
    public maxHealth: number;

    private _damageAudio: Audio;
    private _gun: DirtGun | undefined;

    // Player entities always assign a PlayerController to the entity, so we can safely create a convenience getter
    public get playerController(): PlayerEntityController {
      return this.controller as PlayerEntityController;
    }
  
    public constructor(player: Player, stateManager: PlayerStateManager, dirtBlockManager: DirtBlockManager, world: World) {
      super({
        player,
        name: 'Player',
        modelUri: 'models/players/player.gltf',
        modelScale: 0.5,
        controller: new MyPlayerController(stateManager, dirtBlockManager, world)
      });
      
      // Setup UI
      this.player.ui.load('ui/index.html');
      player.ui.onData = (playerUI: PlayerUI, data: Record<string, any>) => {
        this.handleUIEvent(player, data);
      };
    
      // Set base stats
      this.health = BASE_HEALTH;
      this.maxHealth = BASE_HEALTH;
  
      // Setup damage audio
      this._damageAudio = new Audio({
        attachedToEntity: this,
        uri: 'audio/sfx/player-hurt.mp3',
        loop: false,
        volume: 0.7,
      });  
    }
  

    public equipGun(gun: DirtGun) {
      if (this._gun) { // Keep this check for cleanup
        this._gun.despawn();
      }
      this._gun = gun;
    }
  
    public shoot(origin: Vector3, direction: Vector3) {
      console.log('shooting gun outside');
        if (this._gun) {
            console.log('shooting gun inside');
            this._gun.shoot(origin, direction);
        }
    }

    private handleUIEvent(player: Player, data: Record<string, any>): void {
      console.log('[Server] Received UI action:', data);

      switch (data.type) {
          case 'disablePlayerInput':
              console.log('[Server] Disabling player input');
              player.ui.lockPointer(false);
              break;

          case 'enablePlayerInput':
              console.log('[Server] Enabling player input');
              player.ui.lockPointer(true);
              break;

      }
    }
  }
  