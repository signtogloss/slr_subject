import React, { useState, useEffect, useRef } from 'react';

const SignLanguageRecognition = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recognitions, setRecognitions] = useState([]);
  const [error, setError] = useState('');
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const websocketRef = useRef(null);
  const streamRef = useRef(null);

  // 组件挂载时初始化摄像头和MediaRecorder
  useEffect(() => {
    async function initMedia() {
      try {
        // 获取视频流
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        console.log('视频流初始化成功');

        // 自动选择支持的 MIME 类型
        let mimeType = '';
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
          mimeType = 'video/webm;codecs=vp9';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        } else {
          throw new Error('当前浏览器不支持合适的视频编码格式');
        }
        const options = { bitsPerSecond: 1000000, mimeType };
        mediaRecorderRef.current = new MediaRecorder(stream, options);
        console.log('MediaRecorder 初始化成功，使用 MIME 类型：', mediaRecorderRef.current.mimeType);
      } catch (err) {
        const msg = `摄像头初始化失败: ${err.message}`;
        setError(msg);
        console.error(msg);
      }
    }
    initMedia();

    // 组件卸载时清理资源
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.close();
      }
    };
  }, []);

  // 启动识别逻辑
  const startRecognition = async () => {
    // 获取 API 密钥
    const apiKey = process.env.REACT_APP_SIGNSPEAK_API_KEY;
    if (!apiKey) {
      const msg = 'API密钥未配置，请在环境变量中设置 REACT_APP_SIGNSPEAK_API_KEY';
      setError(msg);
      console.error(msg);
      return;
    }
    setError('');

    // 建立 WebSocket 连接
    // const ws = new WebSocket('wss://api.sign-speak.com/stream-recognize-sign');
    const ws = new WebSocket('wss://06c80bc4930d.ngrok.app/recognize_sign_ws');

    websocketRef.current = ws;

    // 连接打开时启动录制
    ws.addEventListener('open', () => {
      console.log('WebSocket 连接已打开');
      
      // 保留配置包定义，但不发送给后端
      // const configPacket = {
      //   api_key: apiKey,
      //   slice_length: 500,
      //   single_recognition_mode: false,
      // };
      // ws.send(JSON.stringify(configPacket)); // 根据需求，不再发送配置包
      // console.log('配置包(未发送):', configPacket);

      // 当录制到一段视频数据时，调用 ondataavailable 回调发送数据到服务器
      mediaRecorderRef.current.ondataavailable = (event) => {
        console.log('捕获 ondataavailable 事件, 数据大小:', event.data.size, 'bytes');
        // 使用 MediaRecorder 的 MIME 类型构造 Blob
        const blob = new Blob([event.data], { type: mediaRecorderRef.current.mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const buffer = reader.result;
          console.log('发送视频数据分片, 大小:', buffer.byteLength);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(buffer);
          } else {
            console.warn('发送视频数据失败，WebSocket 状态非 OPEN:', ws.readyState);
          }
        };
        reader.readAsArrayBuffer(blob);
      };

      // 开始录制，传入的时间间隔必须与 slice_length 配置一致
      mediaRecorderRef.current.start(500);
      setIsRecording(true);
      console.log('MediaRecorder 开始录制，切片间隔 500ms');
    });

    // 监听 WebSocket 消息，处理服务器返回的数据
    ws.addEventListener('message', (event) => {
      console.log('接收到 WebSocket 消息:', event.data);
      try {
        // 尝试解析服务器返回的 JSON 数据
        const data = JSON.parse(event.data);
        if (data === "OUT_OF_QUOTA") {
          const msg = 'API配额已用尽';
          setError(msg);
          console.error(msg);
          return;
        }
        // 根据返回数据结构提取识别结果字段： prediction 或 predictions 或 results
        const predictions = data.prediction || data.predictions || data.results;
        if (!predictions) {
          console.warn('返回数据中未找到识别结果字段:', data);
          return;
        }
        console.log('解析后的识别结果:', predictions);
        // 更新识别结果列表
        setRecognitions(prev => [...prev, ...predictions]);
      } catch (err) {
        console.error('解析返回数据失败:', err, event.data);
      }
    });

    ws.addEventListener('error', (err) => {
      console.error('WebSocket 出现错误:', err);
      setError('WebSocket 连接错误');
    });

    ws.addEventListener('close', (event) => {
      console.log('WebSocket 连接关闭, 状态码:', event.code, '原因:', event.reason);
      setIsRecording(false);
    });
  };

  // 停止识别并关闭连接
  const stopRecognition = () => {
    console.log('触发停止识别操作');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      console.log('MediaRecorder 已停止录制');
    }
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send('DONE');
      console.log('发送 DONE 信号');
      // websocketRef.current.close();  this is the point, we should not use it.
    }
    setIsRecording(false);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>手语识别 —— 实时接收识别结果</h2>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxWidth: '640px', border: '1px solid #ccc' }}
      ></video>
      {error && <div style={{ color: 'red', marginTop: '10px' }}>错误: {error}</div>}
      <button onClick={isRecording ? stopRecognition : startRecognition} style={{ marginTop: '10px' }}>
        {isRecording ? '停止识别' : '开始识别'}
      </button>
      <div style={{ marginTop: '20px' }}>
        <h3>识别结果</h3>
        {recognitions.length > 0 ? (
          recognitions.map((pred, idx) => {
            // 支持返回对象（包含 prediction, confidence, finished 等）或字符串
            if (typeof pred === 'object') {
              return (
                <div key={idx} style={{ marginBottom: '5px' }}>
                  <strong>{pred.prediction || pred.text || '未知'}</strong> - {Math.round((pred.confidence || 1) * 100)}% {pred.finished && '【完成】'}
                </div>
              );
            } else {
              return <div key={idx} style={{ marginBottom: '5px' }}>{pred}</div>;
            }
          })
        ) : (
          <div>暂无识别结果...</div>
        )}
      </div>
    </div>
  );
};

export default SignLanguageRecognition;
