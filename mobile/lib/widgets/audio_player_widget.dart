import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

/// Native audio player for lesson narration.
/// Matches the web's `AudioPlayer` component: play/pause, seek, speed control.
class AudioPlayerWidget extends StatefulWidget {
  final String url;

  const AudioPlayerWidget({super.key, required this.url});

  @override
  State<AudioPlayerWidget> createState() => _AudioPlayerWidgetState();
}

class _AudioPlayerWidgetState extends State<AudioPlayerWidget> {
  late final AudioPlayer _player;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _ready = false;
  double _speed = 1.0;
  static const _speeds = [0.75, 1.0, 1.25, 1.5, 2.0];

  @override
  void initState() {
    super.initState();
    _player = AudioPlayer();
    _init();
  }

  Future<void> _init() async {
    try {
      final dur = await _player.setUrl(widget.url);
      setState(() {
        _duration = dur ?? Duration.zero;
        _ready = true;
      });
    } catch (e) {
      debugPrint('Audio init failed: $e');
    }
    _player.positionStream.listen((p) {
      if (mounted) setState(() => _position = p);
    });
  }

  void _togglePlay() {
    if (_player.playing) {
      _player.pause();
    } else {
      _player.play();
    }
    setState(() {});
  }

  void _setSpeed(double speed) {
    _player.setSpeed(speed);
    setState(() => _speed = speed);
  }

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.volume_up, color: theme.colorScheme.primary),
              const SizedBox(width: 8),
              Text('Lesson narration',
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 24),
          if (!_ready)
            const Center(child: CircularProgressIndicator())
          else ...[
            Row(
              children: [
                IconButton.filled(
                  icon: Icon(
                    _player.playing ? Icons.pause : Icons.play_arrow,
                  ),
                  onPressed: _togglePlay,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    children: [
                      Slider(
                        min: 0,
                        max: _duration.inMilliseconds.toDouble(),
                        value: _position.inMilliseconds
                            .toDouble()
                            .clamp(0, _duration.inMilliseconds.toDouble()),
                        onChanged: (v) {
                          _player.seek(Duration(milliseconds: v.round()));
                        },
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(_fmt(_position),
                              style: theme.textTheme.labelSmall),
                          Text(_fmt(_duration),
                              style: theme.textTheme.labelSmall),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: _speeds
                  .map((s) => Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: s == _speed
                            ? FilledButton(
                                onPressed: () => _setSpeed(s),
                                child: Text('${s}x'),
                              )
                            : OutlinedButton(
                                onPressed: () => _setSpeed(s),
                                child: Text('${s}x'),
                              ),
                      ))
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }
}
