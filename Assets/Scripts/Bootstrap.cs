using UnityEngine;

// Entry point. Runs automatically on Play (no scene wiring needed) and builds the whole
// slice in code: camera, player, follow + HUD, and a procedural floor. The loop:
// find the boss chamber -> beat OR bribe the gatekeeper -> step into the portal -> descend.
public class Bootstrap : MonoBehaviour
{
    // False if this project's Active Input Handling is the new Input System only
    // (a fresh Unity 6 default), which makes UnityEngine.Input throw. The HUD shows the fix.
    public static bool InputReady = true;

    // True while the player is browsing the gatekeeper's cache at the portal — freezes the player.
    public static bool Paused;

    // The current floor's container, so the top-level Player can parent its shots into it (cleaned up on regen).
    public static Transform WorldRoot;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
        new GameObject("TrialTowers").AddComponent<Bootstrap>();
    }

    public const int FinalFloor = 10;   // Tower's Crown — beating its gatekeeper wins the run
    public int floorNum = 1;
    public bool won;

    // parley state surfaced to the HUD
    public bool nearBoss;
    public bool parleyOpen;
    public int bribeCost;

    // cache (upgrade-shop) state surfaced to the HUD, between beating the portal and descending
    public bool choosing;
    public int[] cacheOffer;
    public bool[] cacheBought = new bool[3];

    GameObject worldRoot;
    Player player;
    Camera cam;
    GameHUD hud;
    Boss currentBoss;
    bool descendPending;

    void Start()
    {
        try { Input.GetKey(KeyCode.Space); InputReady = true; }
        catch { InputReady = false; }

        Physics2D.gravity = Vector2.zero;

        cam = Camera.main;
        if (cam == null)
        {
            var c = new GameObject("Main Camera");
            c.tag = "MainCamera";
            cam = c.AddComponent<Camera>();
        }
        cam.orthographic = true;
        cam.orthographicSize = 9.5f;
        cam.backgroundColor = new Color(0.05f, 0.05f, 0.07f);
        cam.transform.position = new Vector3(0f, 0f, -10f);

        var follow = cam.GetComponent<CameraFollow>();
        if (follow == null) follow = cam.gameObject.AddComponent<CameraFollow>();

        player = MakePlayer();
        follow.target = player.transform;

        hud = cam.GetComponent<GameHUD>();
        if (hud == null) hud = cam.gameObject.AddComponent<GameHUD>();
        hud.player = player;
        hud.boot = this;

        Regenerate();
    }

    void Update()
    {
        if (won) { if (InputReady && Input.GetKeyDown(KeyCode.R)) RestartRun(); return; }   // run cleared — only a fresh run from here
        // stepping into the portal opens the cache instead of descending immediately
        if (descendPending)
        {
            descendPending = false;
            if (floorNum >= FinalFloor) { Win(); return; }   // beat the top floor's gatekeeper -> victory, no further descent
            OpenCache();
        }
        if (choosing) { Cache(); return; }   // browsing the cache: ignore parley, hold the floor
        if (InputReady && Input.GetKeyDown(KeyCode.R)) Regenerate();
        Parley();
    }

    void Win()
    {
        won = true;
        Paused = true;
        Time.timeScale = 0f;   // freeze the cleared floor under the victory banner
    }

    void RestartRun()
    {
        won = false;
        Paused = false;
        Time.timeScale = 1f;
        floorNum = 1;
        if (player != null) Destroy(player.gameObject);   // rebuild a clean player so boons/coins reset
        player = MakePlayer();
        var follow = cam != null ? cam.GetComponent<CameraFollow>() : null;
        if (follow != null) follow.target = player.transform;
        if (hud != null) hud.player = player;
        Regenerate();
    }

    void OpenCache()
    {
        choosing = true;
        Paused = true;
        Time.timeScale = 0f;          // freeze the floor so nothing chips the player mid-menu (Update/Input still run)
        cacheOffer = Boons.RollOffer();
        cacheBought = new bool[3];
    }

    // browse the gatekeeper's cache: buy any boons you can afford (each once), then Enter to descend
    void Cache()
    {
        if (!InputReady) { CloseCacheAndDescend(); return; }   // can't read keys — just go
        for (int i = 0; i < 3; i++)
        {
            KeyCode key = KeyCode.Alpha1 + i;
            if (Input.GetKeyDown(key) && !cacheBought[i])
            {
                var boon = Boons.All[cacheOffer[i]];
                if (player != null && player.coins >= boon.price)
                {
                    player.coins -= boon.price;
                    boon.apply(player);
                    cacheBought[i] = true;
                }
            }
        }
        if (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter))
            CloseCacheAndDescend();
    }

    void CloseCacheAndDescend()
    {
        choosing = false;
        Paused = false;
        floorNum++;
        Regenerate();   // also restores timeScale
    }

    // gatekeeper parley: face a neutral boss to bribe it or challenge it (you can also just attack it to fight)
    void Parley()
    {
        nearBoss = false;
        if (!InputReady || currentBoss == null || currentBoss.provoked || player == null || player.dead) { parleyOpen = false; return; }

        nearBoss = Vector2.Distance(player.transform.position, currentBoss.transform.position) < 2.9f;
        bribeCost = currentBoss.cost;
        if (!nearBoss) { parleyOpen = false; return; }

        if (Input.GetKeyDown(KeyCode.E)) parleyOpen = !parleyOpen;
        if (!parleyOpen) return;

        if (Input.GetKeyDown(KeyCode.Alpha1))
        {
            if (player.coins >= currentBoss.cost) { player.coins -= currentBoss.cost; currentBoss.StandAside(); }
            parleyOpen = false;
        }
        else if (Input.GetKeyDown(KeyCode.Alpha2))
        {
            currentBoss.Provoke();
            parleyOpen = false;
        }
    }

    public Boss CurrentBoss { get { return currentBoss; } }   // for the HUD boss bar (Unity == handles a destroyed boss)

    public void QueueDescend() { descendPending = true; }

    void Regenerate()
    {
        Time.timeScale = 1f;   // unfreeze if we came from the cache (or an R re-roll mid-pause)
        if (worldRoot != null) Destroy(worldRoot);
        worldRoot = new GameObject("World");
        WorldRoot = worldRoot.transform;   // player shots parent here so they're cleared with the floor
        Vector2 spawn = WorldGen.Generate(worldRoot.transform, player != null ? player.transform : null, QueueDescend, floorNum);
        currentBoss = worldRoot.GetComponentInChildren<Boss>();
        parleyOpen = false;
        nearBoss = false;
        choosing = false;
        Paused = false;   // never leave the player frozen after a rebuild
        if (player != null)
        {
            player.transform.position = new Vector3(spawn.x, spawn.y, 0f);
            var rb = player.GetComponent<Rigidbody2D>();
            if (rb != null) rb.linearVelocity = Vector2.zero;
            player.hp = player.maxHp;
            player.dead = false;
        }
        if (hud != null) hud.floor = floorNum;
    }

    Player MakePlayer()
    {
        var go = new GameObject("Player");
        go.transform.localScale = new Vector3(0.8f, 0.8f, 1f);

        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = SpriteFactory.Square();
        sr.color = new Color(0.55f, 0.8f, 1f);
        sr.sortingOrder = 10;

        var rb = go.AddComponent<Rigidbody2D>();
        rb.gravityScale = 0f;
        rb.freezeRotation = true;
        rb.collisionDetectionMode = CollisionDetectionMode2D.Continuous;
        rb.interpolation = RigidbodyInterpolation2D.Interpolate;

        go.AddComponent<BoxCollider2D>();
        return go.AddComponent<Player>();
    }
}
