using UnityEngine;

public class NPC : MonoBehaviour
{
    public string[] lines =
    {
        "Villager: Oh thank goodness, an adventurer!",
        "Villager: Slimes have overrun the meadow. Press SPACE to swing your blade.",
        "Villager: Clear them out and you'll be a hero. Press E to keep talking.",
        "Villager: ...that's all I've got, really. Good luck out there!"
    };

    Transform player;
    bool inRange;
    int line = -1;

    void Start()
    {
        var p = FindObjectOfType<PlayerController>();
        if (p) player = p.transform;
    }

    void Update()
    {
        if (player == null) return;
        bool near = Vector2.Distance(transform.position, player.position) < 1.6f;

        if (near && !inRange)
            GameManager.I.Toast("Press E to talk");
        inRange = near;

        if (!inRange)
        {
            if (line >= 0) { line = -1; GameManager.I.HideDialogue(); }
            return;
        }

        if (Input.GetKeyDown(KeyCode.E))
        {
            line++;
            if (line >= lines.Length) { line = -1; GameManager.I.HideDialogue(); }
            else GameManager.I.ShowDialogue(lines[line]);
        }
    }
}
