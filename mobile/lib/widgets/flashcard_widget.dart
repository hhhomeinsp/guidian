import 'dart:math';
import 'package:flutter/material.dart';

/// Native flashcard widget. Builds cards from the lesson's `objectives` list.
/// In production, this would also pull from spaced-repetition data in the
/// learner's profile. The flip animation uses a 3D transform to match the
/// web `Flashcard` component's Framer Motion flip.
class FlashcardWidget extends StatefulWidget {
  final List<String> objectives;

  const FlashcardWidget({super.key, required this.objectives});

  @override
  State<FlashcardWidget> createState() => _FlashcardWidgetState();
}

class _FlashcardWidgetState extends State<FlashcardWidget>
    with SingleTickerProviderStateMixin {
  int _index = 0;
  bool _flipped = false;
  late final AnimationController _flipCtrl;
  late final Animation<double> _flipAnim;

  List<_Card> _cards = [];

  @override
  void initState() {
    super.initState();
    _flipCtrl = AnimationController(
        duration: const Duration(milliseconds: 400), vsync: this);
    _flipAnim = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _flipCtrl, curve: Curves.easeInOut),
    );
    _cards = widget.objectives
        .map((o) => _Card(front: 'What does this mean?', back: o))
        .toList();
  }

  void _flip() {
    if (_flipped) {
      _flipCtrl.reverse();
    } else {
      _flipCtrl.forward();
    }
    _flipped = !_flipped;
  }

  void _next() {
    if (_index < _cards.length - 1) {
      setState(() {
        _index++;
        _flipped = false;
        _flipCtrl.reset();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_cards.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text('No flashcards available for this lesson.'),
        ),
      );
    }
    final theme = Theme.of(context);
    final card = _cards[_index];

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Text(
            'Card ${_index + 1} / ${_cards.length}',
            style: theme.textTheme.labelSmall,
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: _flip,
            child: AnimatedBuilder(
              animation: _flipAnim,
              builder: (_, __) {
                final angle = _flipAnim.value * pi;
                final showBack = angle > pi / 2;
                return Transform(
                  alignment: Alignment.center,
                  transform: Matrix4.identity()
                    ..setEntry(3, 2, 0.001)
                    ..rotateY(angle),
                  child: Card(
                    elevation: 4,
                    child: Container(
                      height: 220,
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      alignment: Alignment.center,
                      child: showBack
                          ? Transform(
                              alignment: Alignment.center,
                              transform: Matrix4.identity()..rotateY(pi),
                              child: Text(
                                card.back,
                                style: theme.textTheme.bodyLarge,
                                textAlign: TextAlign.center,
                              ),
                            )
                          : Text(
                              card.front,
                              style: theme.textTheme.titleMedium,
                              textAlign: TextAlign.center,
                            ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              for (final label in ['Again', 'Hard', 'Good', 'Easy'])
                OutlinedButton(
                  onPressed: _flipped ? _next : null,
                  child: Text(label),
                ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _flipCtrl.dispose();
    super.dispose();
  }
}

class _Card {
  final String front;
  final String back;
  _Card({required this.front, required this.back});
}
