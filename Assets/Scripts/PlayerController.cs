using UnityEngine;

public class PlayerController : MonoBehaviour
{
    public float moveSpeed = 5.5f;
    public float maxHealth = 100f;

    [HideInInspector] public Vector2 facing = Vector2.down;

    Rigidbody2D rb;
    float health;
    float attackCooldown;
    Vector2 input;
    Vector3 spawn;
    Transform sword;
    SpriteRenderer swordSr;

    void Awake()
    {
        rb = GetComponent<Rigidbody2D>();
        health = maxHealth;
        spawn = transform.position;

        // Sword sprite, hidden until you swing.
        var s = new GameObject("Sword");
        s.transform.SetParent(transform, false);
        swordSr = s.AddComponent<SpriteRenderer>();
        swordSr.sprite = Art.Solid(new Color(0.95f, 0.95f, 1f), 16);
        swordSr.sortingOrder = 6;
        s.transform.localScale = new Vector3(0.35f, 1.1f, 1f);
        sword = s.transform;
        swordSr.enabled = false;
    }

    void Update()
    {
        if (GameManager.I != null) GameManager.I.SetHealth(health / maxHealth);

        input = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
        if (input.sqrMagnitude > 1f) input.Normalize();
        if (input.sqrMagnitude > 0.01f) facing = input;

        attackCooldown -= Time.deltaTime;
        if (Input.GetKeyDown(KeyCode.Space) && attackCooldown <= 0f)
            Attack();
    }

    void FixedUpdate()
    {
        rb.MovePosition(rb.position + input * moveSpeed * Time.fixedDeltaTime);
    }

    void Attack()
    {
        attackCooldown = 0.35f;

        // Position the sword in the facing direction and flash it.
        sword.localPosition = (Vector3)(facing * 0.7f);
        sword.right = facing; // rotate blade to face swing direction
        StopAllCoroutines();
        StartCoroutine(FlashSword());

        // Hit every enemy in a small arc/circle in front of the player.
        Vector2 center = rb.position + facing * 0.7f;
        var hits = Physics2D.OverlapCircleAll(center, 0.7f);
        foreach (var h in hits)
        {
            var e = h.GetComponent<Enemy>();
            if (e != null) e.TakeHit(35f, (Vector2)(e.transform.position - transform.position));
        }
    }

    System.Collections.IEnumerator FlashSword()
    {
        swordSr.enabled = true;
        yield return new WaitForSeconds(0.12f);
        swordSr.enabled = false;
    }

    public void Damage(float amount, Vector2 from)
    {
        health -= amount;
        rb.position += (rb.position - from).normalized * 0.25f; // small knockback
        GameManager.I.Toast("Ouch!");
        if (health <= 0f) Respawn();
    }

    void Respawn()
    {
        health = maxHealth;
        transform.position = spawn;
        GameManager.I.Toast("You fainted... back to start.");
    }
}
